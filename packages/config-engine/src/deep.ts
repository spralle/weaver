// Deep object path utilities — bracket-aware via parsePath
import { parsePath } from "./path.js";

/**
 * Get a value at a dot/bracket path in a nested object.
 * Returns undefined if any segment along the path doesn't exist.
 */
export function deepGet(obj: Record<string, unknown>, path: string): unknown {
  const segments = parsePath(path);
  let current: unknown = obj;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Set a value at a dot/bracket path in a nested object (mutates in place).
 * Creates intermediate objects as needed.
 * If a primitive exists along the path, it's overwritten with an object.
 */
export function deepSet(obj: Record<string, unknown>, path: string, value: unknown): void {
  const segments = parsePath(path);
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]!;
    const next = current[segment];
    if (next === null || next === undefined || typeof next !== "object" || Array.isArray(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]!] = value;
}

/**
 * Remove a leaf value at a dot/bracket path (mutates in place).
 * Only removes the leaf — does NOT prune empty parent objects.
 * Returns true if the key existed and was removed.
 */
export function deepRemove(obj: Record<string, unknown>, path: string): boolean {
  const segments = parsePath(path);
  if (segments.length === 1) {
    const existed = segments[0]! in obj;
    delete obj[segments[0]!];
    return existed;
  }
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]!;
    const next = current[segment];
    if (next === null || next === undefined || typeof next !== "object") {
      return false;
    }
    current = next as Record<string, unknown>;
  }
  const lastSeg = segments[segments.length - 1]!;
  const existed = lastSeg in current;
  delete current[lastSeg];
  return existed;
}
