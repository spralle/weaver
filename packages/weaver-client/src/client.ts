import { deepGet, deepRemove, deepSet } from "@weaver/config-engine";
import type { ScopeDefinition, ScopeInstance } from "@weaver/config-types";
import type { ZodRawShape } from "zod";

import { createInstanceClient } from "./instance-client.js";
import type { InstanceClient } from "./namespace.js";
import type { WeaverClientPersistence } from "./persistence.js";
import { createScopeLoader, type ScopeLoadingMode } from "./scope-manager.js";
import {
  createStalenessMonitor,
  type StalenessConfig,
  type StalenessMonitor,
} from "./staleness.js";
import type {
  WeaverTransport,
  WriteOptions,
  WriteResult,
} from "./transport.js";
import type {
  ClientMode,
  ConfigDelta,
  ConfigSnapshot,
  ConfigurationInspection,
  SchemaOptions,
  Unsubscribe,
} from "./types.js";
import type { ValidationResult } from "./schema-registry.js";
import {
  createClientSchemaRegistry,
  type ClientSchemaRegistry,
} from "./schema-registry.js";
import {
  validateOnRead,
  validateOnWrite,
  type ValidationOptions,
} from "./validation.js";
import { applyNamespace, matchGlob } from "./client-helpers.js";
import type {
  NamespaceDefinition,
  TypedNamespaceClient,
  UntypedNamespaceClient,
} from "./namespace.js";
import { createTypedNamespaceClient } from "./typed-namespace-client.js";
import { createUntypedNamespaceClient } from "./untyped-namespace-client.js";
import {
  registerNamespaces,
  type SchemaRegistrationResult,
} from "./registration.js";

export interface WeaverClientOptions {
  namespace?: string;
  transport: WeaverTransport;
  scopeLoading?: ScopeLoadingMode;
  persistence?: WeaverClientPersistence;
  /** If true and transport fails, boot from cache in degraded mode (default: true if persistence provided) */
  offlineBoot?: boolean;
  /** Staleness detection configuration */
  staleness?: StalenessConfig;
  /** Enable server-schema validation on get/set */
  schemas?: boolean | SchemaOptions;
}

export interface WeaverClient {
  // ── Reads (sync, from local state) ──
  get<T>(key: string): T | undefined;
  get<T>(key: string, scopePath: ScopeInstance[]): T | undefined;
  getWithDefault<T>(key: string, defaultValue: T): T;
  getWithDefault<T>(
    key: string,
    defaultValue: T,
    scopePath: ScopeInstance[],
  ): T;
  getNamespace(prefix: string): Record<string, unknown>;
  getNamespace(
    prefix: string,
    scopePath: ScopeInstance[],
  ): Record<string, unknown>;
  getForScope<T>(key: string, scopePath: ScopeInstance[]): T | undefined;

  // ── Inspection (async, server round-trip) ──
  inspect<T>(key: string): Promise<ConfigurationInspection<T>>;

  // ── Writes (async, goes to server) ──
  set(
    key: string,
    value: unknown,
    options?: WriteOptions,
  ): Promise<WriteResult>;
  setMany(
    entries: Record<string, unknown>,
    options?: WriteOptions,
  ): Promise<WriteResult>;
  setNamespace(
    prefix: string,
    values: Record<string, unknown>,
    options?: WriteOptions,
  ): Promise<WriteResult>;
  remove(key: string, options?: WriteOptions): Promise<WriteResult>;

  // ── Scopes ──
  listScopes(): Promise<ScopeDefinition[]>;
  listScopeValues(
    scopeId: string,
    parentScope?: ScopeInstance[],
  ): Promise<string[]>;
  preloadScope(scopePath: ScopeInstance[]): Promise<void>;

  // ── Change tracking ──
  onChange(
    pattern: string,
    handler: (changes: ConfigDelta[]) => void,
  ): Unsubscribe;
  onRestartRequired(handler: () => void): Unsubscribe;
  readonly pendingRestart: boolean;

  // ── Health ──
  readonly mode: ClientMode;
  readonly revision: string;
  readonly connected: boolean;
  readonly lastSyncedAt: Date | null;
  readonly staleSince: Date | null;

  // ── Validation ──
  validate(key: string, value: unknown): ValidationResult;
  isSensitive(key: string): boolean;

  // ── Namespaces ──
  namespace<TShape extends ZodRawShape>(
    definition: NamespaceDefinition<string, TShape>,
  ): TypedNamespaceClient<TShape>;
  namespace(prefix: string): UntypedNamespaceClient;

  // ── Registration ──
  registerNamespaces(
    definitions: ReadonlyArray<NamespaceDefinition>,
  ): Promise<SchemaRegistrationResult>;

  // ── Instances ──
  instance(basePath: string, instanceId: string): InstanceClient;

  // ── Lifecycle ──
  close(): Promise<void>;
}

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

  let baseState: Record<string, unknown> = {};
  let revision = "";
  let connected = false;
  let lastSyncedAt: Date | null = null;
  // pendingRestart will be set true when schema-breaking deltas arrive
  let pendingRestart = false;

  let staleSince: Date | null = null;
  let closedAt: Date | null = null;
  const stalenessMonitor: StalenessMonitor = createStalenessMonitor(
    options.staleness,
  );

  // Try loading from cache first
  if (persistence) {
    const cached = await persistence.load(namespace ?? "default");
    if (cached) {
      baseState = { ...cached.entries };
      revision = cached.revision;
    }
  }

  // Fetch fresh snapshot from transport
  let freshSnapshot: ConfigSnapshot | null = null;
  try {
    freshSnapshot = await transport.resolveAll();
    baseState = { ...freshSnapshot.entries };
    revision = freshSnapshot.revision;
    lastSyncedAt = new Date();
    connected = true;
    stalenessMonitor.recordSync();

    if (persistence) {
      await persistence.save(namespace ?? "default", freshSnapshot);
    }

    // Load schemas if registry enabled and transport supports it
    if (registry && "fetchSchemas" in transport) {
      try {
        const fetch = (transport as { fetchSchemas: () => Promise<Record<string, unknown>> }).fetchSchemas;
        registry.load(await fetch() as Record<string, import("@weaver/config-types").ConfigurationPropertySchema>);
      } catch { /* Schema loading is optional */ }
    }
  } catch (error) {
    if (offlineBoot && revision) {
      // We have cached data — degrade gracefully
      connected = false;
    } else {
      stalenessMonitor.dispose();
      throw error;
    }
  }

  const scopeLoader = createScopeLoader({
    mode: scopeLoading,
    transport,
    initialSnapshot: freshSnapshot ?? {
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

  // Subscribe to deltas (wrapped for resilience)
  let unsubTransport: Unsubscribe = () => {};
  try {
    unsubTransport = transport.subscribe((delta: ConfigDelta) => {
      if (!delta.layer.includes(":")) {
        if (delta.action === "set") {
          deepSet(baseState, delta.key, delta.value);
        } else {
          deepRemove(baseState, delta.key);
        }
      }

      lastSyncedAt = new Date();
      connected = true;
      stalenessMonitor.recordSync();

      // Check if this delta requires a restart
      if (registry && !pendingRestart) {
        const restartKeys = registry.getRestartRequiredKeys();
        if (restartKeys.includes(delta.key)) {
          pendingRestart = true;
          for (const listener of restartListeners) {
            listener();
          }
        }
      }

      for (const [pattern, handlers] of changeListeners) {
        if (matchGlob(pattern, delta.key)) {
          for (const handler of handlers) {
            handler([delta]);
          }
        }
      }
    });

    if (freshSnapshot) {
      connected = true;
    }
  } catch {
    // Transport subscription unavailable — client operates in degraded mode
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
        value = deepGet(scopeState as Record<string, unknown>, resolvedKey) as
          | T
          | undefined;
      } else {
        value = deepGet(baseState, resolvedKey) as T | undefined;
      }
      return validateOnRead(resolvedKey, value, registry, validationOptions) as T | undefined;
    },

    getWithDefault<T>(
      key: string,
      defaultValue: T,
      scopePath?: ScopeInstance[],
    ): T {
      const value = client.get<T>(key, scopePath as ScopeInstance[]);
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
      const value = deepGet(source as Record<string, unknown>, resolvedPrefix);
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        return value as Record<string, unknown>;
      }
      return {};
    },

    async inspect<T>(key: string): Promise<ConfigurationInspection<T>> {
      const resolvedKey = applyNamespace(namespace, key);
      const raw = await transport.inspect(resolvedKey);
      return raw as ConfigurationInspection<T>;
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

    async listScopes(): Promise<ScopeDefinition[]> {
      return transport.listScopes();
    },

    async listScopeValues(
      scopeId: string,
      parentScope?: ScopeInstance[],
    ): Promise<string[]> {
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

    get mode(): ClientMode {
      if (connected) return "live";
      if (revision) return "cached";
      return "degraded";
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

    instance(basePath: string, instanceId: string): InstanceClient {
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
      return createTypedNamespaceClient(defOrPrefix as NamespaceDefinition<string, ZodRawShape>, {
        getState: (sp) => sp ? (scopeLoader.getScopeState(sp) ?? {}) : baseState,
        set: (key, value, opts) => transport.set(key, value, opts),
        remove: (key, opts) => transport.remove(key, opts),
        onChange: (pattern, handler) => client.onChange(pattern, handler),
      });
    },

    async registerNamespaces(
      definitions: ReadonlyArray<NamespaceDefinition>,
    ): Promise<SchemaRegistrationResult> {
      return registerNamespaces(definitions, transport);
    },
  };

  return client;
}
