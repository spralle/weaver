import { deepGet, deepRemove, deepSet } from "@weaver/config-engine";
import type { ScopeDefinition, ScopeInstance } from "@weaver/config-types";
import type {
  WeaverTransport,
  WriteOptions,
  WriteResult,
} from "./transport.js";
import type {
  ConfigDelta,
  ConfigSnapshot,
  GetOptions,
  ResolveOptions,
  Unsubscribe,
} from "./types.js";

export interface LocalTransportOptions {
  snapshot: ConfigSnapshot;
  latencyMs?: number;
}

export interface LocalTransport extends WeaverTransport {
  pushDelta(delta: ConfigDelta): void;
}

function buildScopeKey(scopePath: ScopeInstance[]): string {
  return scopePath.map((s) => `${s.scopeId}:${s.value}`).join("/");
}

export function createLocalTransport(
  options: LocalTransportOptions,
): LocalTransport {
  const { snapshot, latencyMs } = options;
  const subscribers = new Set<(delta: ConfigDelta) => void>();

  async function withLatency<T>(value: T): Promise<T> {
    if (latencyMs && latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }
    return value;
  }

  return {
    async resolveAll(_opts?: ResolveOptions): Promise<ConfigSnapshot> {
      return withLatency(snapshot);
    },

    async get(key: string, opts?: GetOptions): Promise<unknown> {
      const source = opts?.scopePath?.length
        ? (snapshot.scopes[buildScopeKey(opts.scopePath)] ?? {})
        : snapshot.entries;
      return withLatency(deepGet(source as Record<string, unknown>, key));
    },

    async getNamespace(
      prefix: string,
      opts?: GetOptions,
    ): Promise<Record<string, unknown>> {
      const source = opts?.scopePath?.length
        ? (snapshot.scopes[buildScopeKey(opts.scopePath)] ?? {})
        : snapshot.entries;
      const value = deepGet(source as Record<string, unknown>, prefix);
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        return withLatency(value as Record<string, unknown>);
      }
      return withLatency({});
    },

    subscribe(handler: (delta: ConfigDelta) => void): Unsubscribe {
      subscribers.add(handler);
      return () => {
        subscribers.delete(handler);
      };
    },

    async inspect(key: string): Promise<unknown> {
      const value = deepGet(snapshot.entries as Record<string, unknown>, key);
      return withLatency({ key, value, source: "local" });
    },

    async set(
      key: string,
      value: unknown,
      _options?: WriteOptions,
    ): Promise<WriteResult> {
      deepSet(snapshot.entries as Record<string, unknown>, key, value);
      return withLatency({ success: true, revision: `local-${Date.now()}` });
    },

    async remove(key: string, _options?: WriteOptions): Promise<WriteResult> {
      deepRemove(snapshot.entries as Record<string, unknown>, key);
      return withLatency({ success: true, revision: `local-${Date.now()}` });
    },

    async setMany(
      entries: Record<string, unknown>,
      _options?: WriteOptions,
    ): Promise<WriteResult> {
      for (const [key, value] of Object.entries(entries)) {
        deepSet(snapshot.entries as Record<string, unknown>, key, value);
      }
      return withLatency({ success: true, revision: `local-${Date.now()}` });
    },

    async listScopes(): Promise<ScopeDefinition[]> {
      const scopeIds = new Set<string>();
      for (const scopePathStr of Object.keys(snapshot.scopes ?? {})) {
        const parts = scopePathStr.split("/");
        for (const part of parts) {
          const colonIdx = part.indexOf(":");
          if (colonIdx !== -1) scopeIds.add(part.slice(0, colonIdx));
        }
      }
      return withLatency([...scopeIds].map((id) => ({ id, label: id })));
    },

    async listScopeValues(
      scopeId: string,
      _parentScope?: ScopeInstance[],
    ): Promise<string[]> {
      const values = new Set<string>();
      for (const scopePathStr of Object.keys(snapshot.scopes ?? {})) {
        const parts = scopePathStr.split("/");
        for (const part of parts) {
          const colonIdx = part.indexOf(":");
          if (colonIdx !== -1 && part.slice(0, colonIdx) === scopeId) {
            values.add(part.slice(colonIdx + 1));
          }
        }
      }
      return withLatency([...values]);
    },

    async close(): Promise<void> {
      subscribers.clear();
    },

    pushDelta(delta: ConfigDelta): void {
      for (const handler of subscribers) {
        handler(delta);
      }
    },
  };
}
