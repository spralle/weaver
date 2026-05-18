import type { ScopeResolutionCache } from "@weaver/config-types";

const DEFAULT_MAX_SIZE = 100;

/**
 * LRU cache backed by a Map (insertion-order iteration).
 * On access hit: delete + re-insert to move to end (most recent).
 * On set when full: delete the first key (oldest).
 */
export function createScopeResolutionCache(
  maxSize: number = DEFAULT_MAX_SIZE,
): ScopeResolutionCache {
  const store = new Map<string, Record<string, unknown>>();

  return {
    get(scopeKey: string): Record<string, unknown> | undefined {
      const value = store.get(scopeKey);
      if (value === undefined) return undefined;
      // Move to end (LRU refresh)
      store.delete(scopeKey);
      store.set(scopeKey, value);
      return value;
    },

    set(scopeKey: string, entries: Record<string, unknown>): void {
      if (store.has(scopeKey)) {
        store.delete(scopeKey);
      } else if (store.size >= maxSize) {
        // Evict oldest (first key in Map iteration order)
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(scopeKey, entries);
    },

    clear(): void {
      store.clear();
    },
  };
}
