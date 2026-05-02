import type { ConfigDelta, ConfigSnapshot, GetOptions, ResolveOptions, Unsubscribe } from "./types.js";
import type { WeaverTransport } from "./transport.js";

export interface LocalTransportOptions {
  snapshot: ConfigSnapshot;
  latencyMs?: number;
}

export interface LocalTransport extends WeaverTransport {
  pushDelta(delta: ConfigDelta): void;
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
    async resolveAll(_serviceId: string, opts?: ResolveOptions): Promise<ConfigSnapshot> {
      return withLatency(snapshot);
    },

    async get(_serviceId: string, key: string, opts?: GetOptions): Promise<unknown> {
      const source = opts?.tenantId
        ? snapshot.tenants[opts.tenantId] ?? {}
        : snapshot.platform;
      return withLatency(source[key]);
    },

    async getNamespace(_serviceId: string, prefix: string, opts?: GetOptions): Promise<Record<string, unknown>> {
      const source = opts?.tenantId
        ? snapshot.tenants[opts.tenantId] ?? {}
        : snapshot.platform;
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(source)) {
        if (key.startsWith(prefix)) {
          result[key] = value;
        }
      }
      return withLatency(result);
    },

    subscribe(_serviceId: string, handler: (delta: ConfigDelta) => void): Unsubscribe {
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
