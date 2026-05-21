/// <reference lib="dom" />

import type { WeaverClientPersistence } from "./persistence.js";
import type { ConfigSnapshot } from "./types.js";

/** Options for IndexedDB-based snapshot persistence (browser environments). */
export interface IndexedDbPersistenceOptions {
  /** Database name (default: "weaver-config") */
  dbName?: string;
  /** Object store name (default: "snapshots") */
  storeName?: string;
}

/**
 * Creates an IndexedDB persistence adapter for browser-based snapshot caching.
 *
 * @param options - Database and store name configuration
 */
export function createIndexedDbPersistence(
  options?: IndexedDbPersistenceOptions,
): WeaverClientPersistence {
  const dbName = options?.dbName ?? "weaver-config";
  const storeName = options?.storeName ?? "snapshots";

  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return {
    async save(namespace: string, snapshot: ConfigSnapshot): Promise<void> {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const data = { ...snapshot, savedAt: Date.now() };
        store.put(data, namespace);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      });
    },

    async load(namespace: string): Promise<ConfigSnapshot | null> {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const request = store.get(namespace);
        request.onsuccess = () => {
          db.close();
          resolve(request.result ?? null);
        };
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      });
    },
  };
}
