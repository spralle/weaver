import type { ScopeInstance } from "./types.js";

/**
 * Pluggable cache for resolved scope configuration entries.
 * Implementations control eviction strategy and storage medium.
 */
export interface ScopeResolutionCache {
  /** Get cached resolved entries for a scope path, or undefined on miss. */
  get(scopeKey: string): Record<string, unknown> | undefined;
  /** Store resolved entries for a scope path. */
  set(scopeKey: string, entries: Record<string, unknown>): void;
  /** Invalidate all cached entries (called on any layer mutation). */
  clear(): void;
}

/**
 * Deterministic serialization of a scope path into a cache key.
 * Preserves order — [country:GB, location:GBDVR] ≠ [location:GBDVR, country:GB].
 */
export function serializeScopePath(scopePath: ScopeInstance[]): string {
  return scopePath.map((s) => `${s.scopeId}:${s.value}`).join("|");
}
