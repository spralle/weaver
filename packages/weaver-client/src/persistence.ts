import type { ConfigSnapshot } from "./types.js";

/** Persistence adapter for saving/loading config snapshots across sessions. */
export interface WeaverClientPersistence {
  save(namespace: string, snapshot: ConfigSnapshot): Promise<void>;
  load(namespace: string): Promise<ConfigSnapshot | null>;
}
