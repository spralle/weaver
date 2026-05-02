import type { ConfigDelta, GetOptions, ResolveOptions, Unsubscribe, ConfigSnapshot } from "./types.js";

export interface WeaverTransport {
  resolveAll(serviceId: string, options?: ResolveOptions): Promise<ConfigSnapshot>;
  get(serviceId: string, key: string, options?: GetOptions): Promise<unknown>;
  getNamespace(serviceId: string, prefix: string, options?: GetOptions): Promise<Record<string, unknown>>;
  subscribe(serviceId: string, handler: (delta: ConfigDelta) => void): Unsubscribe;
  close(): Promise<void>;
}
