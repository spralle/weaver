import type { ScopeInstance } from "@weaver/config-types";
import type { ConfigDelta, ConfigSnapshot, GetOptions, ResolveOptions, Unsubscribe } from "./types.js";
import type { WeaverTransport } from "./transport.js";

export interface LocalTransportOptions {
  snapshot: ConfigSnapshot;
  latencyMs?: number;
}

export interface LocalTransport extends WeaverTransport {
  pushDelta(delta: ConfigDelta): void;
}

function buildScopeKey(scopePath: ScopeInstance[]): string {
  return scopePath.map(s => `${s.scopeId}:${s.value}`).join("/");
}

export function createLocalTransport(options: LocalTransportOptions): LocalTransport {
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
        ? snapshot.scopes[buildScopeKey(opts.scopePath)] ?? {}
        : snapshot.entries;
      return withLatency(source[key]);
    },

    async getNamespace(prefix: string, opts?: GetOptions): Promise<Record<string, unknown>> {
      const source = opts?.scopePath?.length
        ? snapshot.scopes[buildScopeKey(opts.scopePath)] ?? {}
        : snapshot.entries;
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(source)) {
        if (key.startsWith(prefix)) {
          result[key] = value;
        }
      }
      return withLatency(result);
    },

    subscribe(handler: (delta: ConfigDelta) => void): Unsubscribe {
      subscribers.add(handler);
      return () => {
        subscribers.delete(handler);
      };
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
