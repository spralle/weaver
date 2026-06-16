import { getCachedRegex } from "./regex-cache";

/**
 * Match a dot-separated key against a glob pattern.
 * Supports `*` (any chars in a single segment) and `**` (any path segments).
 */
export function matchGlob(pattern: string, key: string): boolean {
  const regex = globToRegex(pattern);
  return regex.test(key);
}

function globToRegex(pattern: string): RegExp {
  let result = "^";
  const parts = pattern.split(".");
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) result += "\\.";
    const part = parts[i]!;
    if (part === "**") {
      result += ".*";
      if (i < parts.length - 1) {
        result += "\\.?";
      }
    } else {
      result += part.replace(/\*/g, "[^.]*");
    }
  }
  result += "$";
  return getCachedRegex(result);
}
