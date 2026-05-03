import type { ConfigDelta, GetOptions, ResolveOptions, Unsubscribe, ConfigSnapshot } from "./types.js";

export interface WeaverTransport {
  resolveAll(options?: ResolveOptions): Promise<ConfigSnapshot>;
  get(key: string, options?: GetOptions): Promise<unknown>;
  getNamespace(prefix: string, options?: GetOptions): Promise<Record<string, unknown>>;
  subscribe(handler: (delta: ConfigDelta) => void): Unsubscribe;
  close(): Promise<void>;
}
