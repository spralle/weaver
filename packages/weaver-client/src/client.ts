import { deepGet } from "@weaver/config-engine";
import type { ScopeInstance } from "@weaver/config-types";
import type { ZodRawShape } from "zod";

import { bootClient } from "./client-boot.js";
import { setupDeltaSubscription } from "./client-subscriptions.js";
import type { WeaverClient, WeaverClientOptions } from "./client-types.js";
import { createInstanceClient } from "./instance-client.js";
import { createScopeLoader } from "./scope-manager.js";
import { createStalenessMonitor } from "./staleness.js";
import type { WriteOptions, WriteResult } from "./transport.js";
import type { ConfigDelta, Unsubscribe } from "./types.js";
import {
  createClientSchemaRegistry,
  type ClientSchemaRegistry,
} from "./schema-registry.js";
import {
  validateOnRead,
  validateOnWrite,
  type ValidationOptions,
} from "./validation.js";
import { applyNamespace } from "./client-helpers.js";
import type { NamespaceDefinition } from "./namespace.js";
import { createTypedNamespaceClient } from "./typed-namespace-client.js";
import { createUntypedNamespaceClient } from "./untyped-namespace-client.js";
import { registerNamespaces } from "./registration.js";
import type { SchemaOptions } from "./types.js";
import type { ValidationResult } from "./schema-registry.js";

export type { WeaverClient, WeaverClientOptions } from "./client-types.js";

/**
 * Creates a Weaver client with the specified transport and options.
 *
 * @param options - Client configuration including transport, persistence, and schema settings
 * @returns A connected WeaverClient instance ready for reads, writes, and subscriptions
 *
 * @example
 * ```ts
 * const client = await createWeaverClient({
 *   transport: createHttpTransport({ baseUrl: "http://localhost:3399" }),
 * });
 * const value = client.get("theme.mode");
 * ```
 */
export async function createWeaverClient(
  options: WeaverClientOptions,
): Promise<WeaverClient> {
  const { namespace, transport, scopeLoading = "lazy", persistence } = options;
  const offlineBoot = options.offlineBoot ?? !!persistence;

  // Schema validation setup
  const schemaOpts: SchemaOptions | undefined =
    options.schemas === true ? {} : options.schemas || undefined;
  const registry: ClientSchemaRegistry | undefined = schemaOpts
    ? createClientSchemaRegistry()
    : undefined;
  const validationOptions: ValidationOptions = {
    warnOnMismatch: schemaOpts?.warnOnMismatch ?? true,
  };

  let pendingRestart = false;
  let staleSince: Date | null = null;
  let closedAt: Date | null = null;
  const stalenessMonitor = createStalenessMonitor(options.staleness);

  // Boot: load cache + fetch snapshot + load schemas
  const boot = await bootClient({
    namespace,
    transport,
    persistence,
    offlineBoot,
    registry,
    stalenessMonitor,
  });

  const baseState = boot.baseState;
  const revision = boot.revision;
  let connected = boot.connected;
  let lastSyncedAt = boot.lastSyncedAt;

  const scopeLoader = createScopeLoader({
    mode: scopeLoading,
    transport,
    initialSnapshot: boot.freshSnapshot ?? {
      entries: baseState,
      scopes: {},
      revision,
      timestamp: new Date().toISOString(),
    },
  });

  const changeListeners = new Map<
    string,
    Set<(changes: ConfigDelta[]) => void>
  >();
  const restartListeners = new Set<() => void>();

  // Subscribe to deltas
  let unsubTransport: Unsubscribe = () => {};
  try {
    unsubTransport = setupDeltaSubscription({
      baseState,
      transport,
      registry,
      changeListeners,
      restartListeners,
      stalenessMonitor,
      onSync: (date) => {
        lastSyncedAt = date;
        connected = true;
      },
      onRestartRequired: () => {
        pendingRestart = true;
      },
    });

    if (boot.freshSnapshot) {
      connected = true;
    }
  } catch {
    connected = false;
    if (!staleSince) staleSince = new Date();
  }

  const client: WeaverClient = {
    get<T>(key: string, scopePath?: ScopeInstance[]): T | undefined {
      const resolvedKey = applyNamespace(namespace, key);
      let value: T | undefined;
      if (scopePath) {
        const scopeState = scopeLoader.getScopeState(scopePath);
        if (!scopeState) return undefined;
        // SAFETY: deepGet returns the stored value which was set with correct type
        value = deepGet(scopeState, resolvedKey) as
          | T
          | undefined;
      } else {
        // SAFETY: deepGet returns the stored value which was set with correct type
        value = deepGet(baseState, resolvedKey) as T | undefined;
      }
      // SAFETY: validateOnRead preserves the type or returns undefined
      return validateOnRead(resolvedKey, value, registry, validationOptions) as T | undefined;
    },

    getWithDefault<T>(
      key: string,
      defaultValue: T,
      scopePath?: ScopeInstance[],
    ): T {
      const value = scopePath ? client.get<T>(key, scopePath) : client.get<T>(key);
      return value !== undefined ? value : defaultValue;
    },

    getForScope<T>(key: string, scopePath: ScopeInstance[]): T | undefined {
      return client.get<T>(key, scopePath);
    },

    getNamespace(
      prefix: string,
      scopePath?: ScopeInstance[],
    ): Record<string, unknown> {
      const resolvedPrefix = applyNamespace(namespace, prefix);
      const source = scopePath
        ? (scopeLoader.getScopeState(scopePath) ?? {})
        : baseState;
      const value = deepGet(source, resolvedPrefix);
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        return value as Record<string, unknown>; // SAFETY: guarded by typeof/null/array checks
      }
      return {};
    },

    async inspect<T>(key: string): Promise<import("./types.js").ConfigurationInspection<T>> {
      const resolvedKey = applyNamespace(namespace, key);
      const raw = await transport.inspect(resolvedKey);
      // SAFETY: transport.inspect returns the inspection structure matching ConfigurationInspection<T>
      return raw as import("./types.js").ConfigurationInspection<T>;
    },

    async set(
      key: string,
      value: unknown,
      opts?: WriteOptions,
    ): Promise<WriteResult> {
      const resolvedKey = applyNamespace(namespace, key);
      const result = validateOnWrite(resolvedKey, value, registry);
      if (!result.valid) {
        const message = result.errors?.map((e) => e.message).join(", ") ?? "Validation failed";
        return { success: false, error: { code: "VALIDATION_ERROR", message, details: { errors: result.errors } } };
      }
      return transport.set(resolvedKey, value, opts);
    },

    async remove(key: string, opts?: WriteOptions): Promise<WriteResult> {
      const resolvedKey = applyNamespace(namespace, key);
      return transport.remove(resolvedKey, opts);
    },

    async setMany(
      entries: Record<string, unknown>,
      opts?: WriteOptions,
    ): Promise<WriteResult> {
      const prefixed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(entries)) {
        prefixed[applyNamespace(namespace, key)] = value;
      }
      return transport.setMany(prefixed, opts);
    },

    async setNamespace(
      prefix: string,
      values: Record<string, unknown>,
      opts?: WriteOptions,
    ): Promise<WriteResult> {
      const resolvedPrefix = applyNamespace(namespace, prefix);
      return transport.setMany({ [resolvedPrefix]: values }, opts);
    },

    async listScopes() {
      return transport.listScopes();
    },

    async listScopeValues(scopeId: string, parentScope?: ScopeInstance[]) {
      return transport.listScopeValues(scopeId, parentScope);
    },

    onChange(
      pattern: string,
      handler: (changes: ConfigDelta[]) => void,
    ): Unsubscribe {
      if (!changeListeners.has(pattern)) {
        changeListeners.set(pattern, new Set());
      }
      changeListeners.get(pattern)!.add(handler);
      return () => {
        changeListeners.get(pattern)?.delete(handler);
      };
    },

    onRestartRequired(handler: () => void): Unsubscribe {
      restartListeners.add(handler);
      return () => {
        restartListeners.delete(handler);
      };
    },

    async preloadScope(scopePath: ScopeInstance[]): Promise<void> {
      await scopeLoader.preloadScope(scopePath);
    },

    get pendingRestart(): boolean {
      return pendingRestart;
    },

    get mode() {
      if (connected) return "live" as const;
      if (revision) return "cached" as const;
      return "degraded" as const;
    },

    get revision(): string {
      return revision;
    },

    get connected(): boolean {
      return connected;
    },

    get lastSyncedAt(): Date | null {
      return lastSyncedAt;
    },

    get staleSince(): Date | null {
      return closedAt ?? staleSince ?? stalenessMonitor.staleSince;
    },

    validate(key: string, value: unknown): ValidationResult {
      const resolvedKey = applyNamespace(namespace, key);
      if (!registry) return { valid: true };
      return registry.validate(resolvedKey, value);
    },

    isSensitive(key: string): boolean {
      const resolvedKey = applyNamespace(namespace, key);
      if (!registry) return false;
      return registry.isSensitive(resolvedKey);
    },

    async close(): Promise<void> {
      unsubTransport();
      connected = false;
      closedAt = new Date();
      stalenessMonitor.dispose();
      await transport.close();
    },

    instance(basePath: string, instanceId: string) {
      const resolvedBase = applyNamespace(namespace, basePath);
      return createInstanceClient(resolvedBase, instanceId, {
        getState: () => baseState,
        set: (key, value, opts) => transport.set(key, value, opts),
        remove: (key, opts) => transport.remove(key, opts),
        onChange: (pattern, handler) => client.onChange(pattern, handler),
      });
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    namespace(defOrPrefix: NamespaceDefinition | string): any {
      if (typeof defOrPrefix === "string") {
        const resolvedPrefix = applyNamespace(namespace, defOrPrefix);
        return createUntypedNamespaceClient(resolvedPrefix, {
          getState: (sp) => sp ? (scopeLoader.getScopeState(sp) ?? {}) : baseState,
          set: (key, value, opts) => transport.set(key, value, opts),
          setMany: (entries, opts) => transport.setMany(entries, opts),
          remove: (key, opts) => transport.remove(key, opts),
          onChange: (pattern, handler) => client.onChange(pattern, handler),
        });
      }
      // SAFETY: defOrPrefix is NamespaceDefinition which extends NamespaceDefinition<string, ZodRawShape>
      return createTypedNamespaceClient(defOrPrefix as NamespaceDefinition<string, ZodRawShape>, {
        getState: (sp) => sp ? (scopeLoader.getScopeState(sp) ?? {}) : baseState,
        set: (key, value, opts) => transport.set(key, value, opts),
        remove: (key, opts) => transport.remove(key, opts),
        onChange: (pattern, handler) => client.onChange(pattern, handler),
      });
    },

    async registerNamespaces(definitions: ReadonlyArray<NamespaceDefinition>) {
      return registerNamespaces(definitions, transport);
    },
  };

  return client;
}
