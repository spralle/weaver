import type { ConfigSnapshot } from "./types.js";

export interface WeaverClientPersistence {
  save(namespace: string, snapshot: ConfigSnapshot): Promise<void>;
  load(namespace: string): Promise<ConfigSnapshot | null>;
}
