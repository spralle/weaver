import { deepGet, deepRemove, deepSet } from "@weaver/config-engine";
import type { ScopeDefinition, ScopeInstance } from "@weaver/config-types";

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
  ConfigDelta,
  ConfigSnapshot,
  ConfigurationInspection,
  Unsubscribe,
} from "./types.js";

export interface WeaverClientOptions {
  namespace?: string;
  transport: WeaverTransport;
  scopeLoading?: ScopeLoadingMode;
  persistence?: WeaverClientPersistence;
  /** If true and transport fails, boot from cache in degraded mode (default: true if persistence provided) */
  offlineBoot?: boolean;
  /** Staleness detection configuration */
  staleness?: StalenessConfig;
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
  readonly revision: string;
  readonly connected: boolean;
  readonly lastSyncedAt: Date | null;
  readonly staleSince: Date | null;

  // ── Lifecycle ──
  close(): Promise<void>;
}

function matchGlob(pattern: string, key: string): boolean {
  const regex = new RegExp(
    "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, "[^.]*") + "$",
  );
  return regex.test(key);
}

function applyNamespace(namespace: string | undefined, key: string): string {
  if (!namespace) return key;
  if (key.startsWith("/")) return key.slice(1);
  return `${namespace}.${key}`;
}

export async function createWeaverClient(
  options: WeaverClientOptions,
): Promise<WeaverClient> {
  const { namespace, transport, scopeLoading = "lazy", persistence } = options;
  const offlineBoot = options.offlineBoot ?? !!persistence;

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
      if (scopePath) {
        const scopeState = scopeLoader.getScopeState(scopePath);
        if (!scopeState) return undefined;
        return deepGet(scopeState as Record<string, unknown>, resolvedKey) as
          | T
          | undefined;
      }
      return deepGet(baseState, resolvedKey) as T | undefined;
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

    async close(): Promise<void> {
      unsubTransport();
      connected = false;
      closedAt = new Date();
      stalenessMonitor.dispose();
      await transport.close();
    },
  };

  return client;
}
