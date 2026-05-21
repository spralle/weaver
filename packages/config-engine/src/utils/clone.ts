declare function structuredClone<T>(value: T): T;

/**
 * Deep-clone a value. Uses structuredClone when available, falls back to JSON round-trip.
 */
export function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T; // SAFETY: JSON roundtrip preserves structure, caller asserts type
}
