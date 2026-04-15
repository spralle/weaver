// Deep merge utility for configuration layer resolution

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * Deep merges two configuration objects.
 *
 * Rules:
 * - Objects: recursively deep merge
 * - Arrays: override replaces base (no concatenation)
 * - Primitives: override replaces base
 * - null in override: clears the value (returns null, blocking lower layers)
 * - undefined in override: skipped (does not override base)
 * - Non-plain objects (Date, RegExp, etc.): replace, don't merge
 */
export function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Copy all base keys
  for (const key of Object.keys(base)) {
    result[key] = base[key];
  }

  // Apply override keys
  for (const key of Object.keys(override)) {
    const overrideValue = override[key];

    // undefined in override → skip (do not override base)
    if (overrideValue === undefined) {
      continue;
    }

    // null in override → clear the value
    if (overrideValue === null) {
      result[key] = null;
      continue;
    }

    const baseValue = result[key];

    // Both are plain objects → recurse
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(baseValue, overrideValue);
      continue;
    }

    // Everything else (arrays, primitives, non-plain objects): override wins
    result[key] = overrideValue;
  }

  return result;
}
