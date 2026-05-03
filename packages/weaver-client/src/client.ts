import type { ScopeInstance } from "@weaver/config-types";
import type { ConfigDelta, ConfigSnapshot, GetOptions, Unsubscribe } from "./types.js";
import type { WeaverTransport } from "./transport.js";
import type { WeaverClientPersistence } from "./persistence.js";
import { createScopeLoader, type ScopeLoadingMode } from "./scope-manager.js";

export interface WeaverClientOptions {
  namespace?: string;
  transport: WeaverTransport;
  scopeLoading?: ScopeLoadingMode;
  persistence?: WeaverClientPersistence;
}

export interface WeaverClient {
  get(key: string, options?: GetOptions): unknown;
  getNamespace(prefix: string, options?: GetOptions): Record<string, unknown>;
  onChange(pattern: string, handler: (changes: ConfigDelta[]) => void): Unsubscribe;
  onRestartRequired(handler: () => void): Unsubscribe;
  preloadScope(scopePath: ScopeInstance[]): Promise<void>;
  readonly revision: string;
  readonly connected: boolean;
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

  // Try loading from cache first
  let snapshot: ConfigSnapshot | null = null;
  if (persistence) {
    snapshot = await persistence.load(namespace ?? "default");
    if (snapshot) {
      baseState = { ...snapshot.entries };
      revision = snapshot.revision;
    }
  }

  // Fetch fresh snapshot from transport
  const freshSnapshot = await transport.resolveAll();
  baseState = { ...freshSnapshot.entries };
  revision = freshSnapshot.revision;
  snapshot = freshSnapshot;

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
    // Apply to base or scope state
    if (!delta.layer.includes(":")) {
      if (delta.action === "set") {
        baseState[delta.key] = delta.value;
      } else {
        delete baseState[delta.key];
      }
    }
    // Scoped deltas would need scope path parsing — for now just update base

    // Fire matching onChange listeners
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
    get(key: string, opts?: GetOptions): unknown {
      const resolvedKey = applyNamespace(namespace, key);
      if (opts?.scopePath) {
        const scopeState = scopeLoader.getScopeState(opts.scopePath);
        return scopeState?.[resolvedKey];
      }
      return baseState[resolvedKey];
    },

    getNamespace(prefix: string, opts?: GetOptions): Record<string, unknown> {
      const resolvedPrefix = applyNamespace(namespace, prefix);
      const source = opts?.scopePath
        ? scopeLoader.getScopeState(opts.scopePath) ?? {}
        : baseState;
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(source)) {
        if (key.startsWith(resolvedPrefix)) {
          result[key] = value;
        }
      }
      return result;
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

    get revision(): string {
      return revision;
    },

    get connected(): boolean {
      return connected;
    },

    async close(): Promise<void> {
      unsubTransport();
      connected = false;
      await transport.close();
    },
  };

  return client;
}
