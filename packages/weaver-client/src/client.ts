import type { ScopeDefinition, ScopeInstance } from "@weaver/config-types";
import type { ConfigDelta, ConfigSnapshot, ConfigurationInspection, Unsubscribe } from "./types.js";
import type { WeaverTransport, WriteOptions, WriteResult } from "./transport.js";
import type { WeaverClientPersistence } from "./persistence.js";
import { createScopeLoader, type ScopeLoadingMode } from "./scope-manager.js";
import { deepGet, deepSet, deepRemove } from "@weaver/config-engine";
import { flattenObject } from "./flatten.js";

export interface WeaverClientOptions {
  namespace?: string;
  transport: WeaverTransport;
  scopeLoading?: ScopeLoadingMode;
  persistence?: WeaverClientPersistence;
}

export interface WeaverClient {
  // ── Reads (sync, from local state) ──
  get<T>(key: string): T | undefined;
  get<T>(key: string, scopePath: ScopeInstance[]): T | undefined;
  getWithDefault<T>(key: string, defaultValue: T): T;
  getWithDefault<T>(key: string, defaultValue: T, scopePath: ScopeInstance[]): T;
  getAtLayer<T>(layer: string, key: string): T | undefined;
  getNamespace(prefix: string): Record<string, unknown>;
  getNamespace(prefix: string, scopePath: ScopeInstance[]): Record<string, unknown>;
  getForScope<T>(key: string, scopePath: ScopeInstance[]): T | undefined;

  // ── Inspection (async, server round-trip) ──
  inspect<T>(key: string): Promise<ConfigurationInspection<T>>;

  // ── Writes (async, goes to server) ──
  set(key: string, value: unknown, options?: WriteOptions): Promise<WriteResult>;
  setMany(entries: Record<string, unknown>, options?: WriteOptions): Promise<WriteResult>;
  setNamespace(prefix: string, values: Record<string, unknown>, options?: WriteOptions): Promise<WriteResult>;
  remove(key: string, options?: WriteOptions): Promise<WriteResult>;

  // ── Scopes ──
  listScopes(): Promise<ScopeDefinition[]>;
  listScopeValues(scopeId: string, parentScope?: ScopeInstance[]): Promise<string[]>;
  preloadScope(scopePath: ScopeInstance[]): Promise<void>;

  // ── Change tracking ──
  onChange(pattern: string, handler: (changes: ConfigDelta[]) => void): Unsubscribe;
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

export async function createWeaverClient(options: WeaverClientOptions): Promise<WeaverClient> {
  const { namespace, transport, scopeLoading = "lazy", persistence } = options;

  let baseState: Record<string, unknown> = {};
  let revision = "";
  let connected = false;
  let lastSyncedAt: Date | null = null;
  let staleSince: Date | null = null;
  let pendingRestart = false;

  // Try loading from cache first
  if (persistence) {
    const cached = await persistence.load(namespace ?? "default");
    if (cached) {
      baseState = { ...cached.entries };
      revision = cached.revision;
    }
  }

  // Fetch fresh snapshot from transport
  const freshSnapshot = await transport.resolveAll();
  baseState = { ...freshSnapshot.entries };
  revision = freshSnapshot.revision;
  lastSyncedAt = new Date();

  if (persistence) {
    await persistence.save(namespace ?? "default", freshSnapshot);
  }

  const scopeLoader = createScopeLoader({
    mode: scopeLoading,
    transport,
    initialSnapshot: freshSnapshot,
  });

  const changeListeners = new Map<string, Set<(changes: ConfigDelta[]) => void>>();
  const restartListeners = new Set<() => void>();

  // Subscribe to deltas
  const unsubTransport = transport.subscribe((delta: ConfigDelta) => {
    if (!delta.layer.includes(":")) {
      if (delta.action === "set") {
        deepSet(baseState, delta.key, delta.value);
      } else {
        deepRemove(baseState, delta.key);
      }
    }

    lastSyncedAt = new Date();

    for (const [pattern, handlers] of changeListeners) {
      if (matchGlob(pattern, delta.key)) {
        for (const handler of handlers) {
          handler([delta]);
        }
      }
    }
  });

  connected = true;

  const client: WeaverClient = {
    get<T>(key: string, scopePath?: ScopeInstance[]): T | undefined {
      const resolvedKey = applyNamespace(namespace, key);
      if (scopePath) {
        const scopeState = scopeLoader.getScopeState(scopePath);
        if (!scopeState) return undefined;
        return deepGet(scopeState as Record<string, unknown>, resolvedKey) as T | undefined;
      }
      return deepGet(baseState, resolvedKey) as T | undefined;
    },

    getWithDefault<T>(key: string, defaultValue: T, scopePath?: ScopeInstance[]): T {
      const value = client.get<T>(key, scopePath as ScopeInstance[]);
      return value !== undefined ? value : defaultValue;
    },

    // Per-layer reads require local layer tracking; returns undefined for v1
    getAtLayer<T>(_layer: string, _key: string): T | undefined {
      return undefined;
    },

    getForScope<T>(key: string, scopePath: ScopeInstance[]): T | undefined {
      return client.get<T>(key, scopePath);
    },

    getNamespace(prefix: string, scopePath?: ScopeInstance[]): Record<string, unknown> {
      const resolvedPrefix = applyNamespace(namespace, prefix);
      const source = scopePath
        ? scopeLoader.getScopeState(scopePath) ?? {}
        : baseState;
      const value = deepGet(source as Record<string, unknown>, resolvedPrefix);
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
      return {};
    },

    async inspect<T>(key: string): Promise<ConfigurationInspection<T>> {
      const resolvedKey = applyNamespace(namespace, key);
      const raw = await transport.inspect(resolvedKey);
      return raw as ConfigurationInspection<T>;
    },

    async set(key: string, value: unknown, opts?: WriteOptions): Promise<WriteResult> {
      const resolvedKey = applyNamespace(namespace, key);
      return transport.set(resolvedKey, value, opts);
    },

    async remove(key: string, opts?: WriteOptions): Promise<WriteResult> {
      const resolvedKey = applyNamespace(namespace, key);
      return transport.remove(resolvedKey, opts);
    },

    async setMany(entries: Record<string, unknown>, opts?: WriteOptions): Promise<WriteResult> {
      const prefixed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(entries)) {
        prefixed[applyNamespace(namespace, key)] = value;
      }
      return transport.setMany(prefixed, opts);
    },

    async setNamespace(prefix: string, values: Record<string, unknown>, opts?: WriteOptions): Promise<WriteResult> {
      const resolvedPrefix = applyNamespace(namespace, prefix);
      const flattened = flattenObject(values, resolvedPrefix);
      return transport.setMany(flattened, opts);
    },

    async listScopes(): Promise<ScopeDefinition[]> {
      return transport.listScopes();
    },

    async listScopeValues(scopeId: string, parentScope?: ScopeInstance[]): Promise<string[]> {
      return transport.listScopeValues(scopeId, parentScope);
    },

    onChange(pattern: string, handler: (changes: ConfigDelta[]) => void): Unsubscribe {
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
      return staleSince;
    },

    async close(): Promise<void> {
      unsubTransport();
      connected = false;
      staleSince = new Date();
      await transport.close();
    },
  };

  return client;
}
