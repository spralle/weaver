import type { ConfigSnapshot } from "./types.js";
import type { WeaverClientPersistence } from "./persistence.js";

export interface IndexedDbPersistenceOptions {
  dbName?: string;
}

// Stubbed — real implementation will use IndexedDB store "snapshots" keyed by namespace.
export function createIndexedDbPersistence(_options?: IndexedDbPersistenceOptions): WeaverClientPersistence {
  return {
    async save(_namespace: string, _snapshot: ConfigSnapshot): Promise<void> {
      throw new Error("IndexedDB persistence requires a browser environment");
    },

    async load(_namespace: string): Promise<ConfigSnapshot | null> {
      throw new Error("IndexedDB persistence requires a browser environment");
    },
  };
}
