/**
 * Flatten a nested object to dot-delimited key-value pairs.
 * Arrays are stored as-is (not flattened by index).
 * Compound segments (containing dots) are wrapped in brackets.
 */
export function flattenObject(
  obj: Record<string, unknown>,
  prefix?: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  function walk(current: Record<string, unknown>, path: string): void {
    for (const [key, value] of Object.entries(current)) {
      const segment = key.includes(".") ? `[${key}]` : key;
      const fullKey = path
        ? segment.startsWith("[") ? `${path}${segment}` : `${path}.${segment}`
        : segment;
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        walk(value as Record<string, unknown>, fullKey);
      } else {
        result[fullKey] = value;
      }
    }
  }

  walk(obj, prefix ?? "");
  return result;
}
