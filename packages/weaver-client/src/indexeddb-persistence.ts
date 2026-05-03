import type { ConfigSnapshot } from "./types.js";
import type { WeaverClientPersistence } from "./persistence.js";

export interface IndexedDbPersistenceOptions {
  dbName?: string;
}

// TODO: Requires browser environment with IndexedDB API.
// Stubbed for now — real implementation will use IndexedDB store "snapshots" keyed by serviceId.
export function createIndexedDbPersistence(_options?: IndexedDbPersistenceOptions): WeaverClientPersistence {
  return {
    async save(_serviceId: string, _snapshot: ConfigSnapshot): Promise<void> {
      throw new Error("IndexedDB persistence requires a browser environment");
    },

    async load(_serviceId: string): Promise<ConfigSnapshot | null> {
      throw new Error("IndexedDB persistence requires a browser environment");
    },
  };
}
