/**
 * Regex caching utility to avoid repeated compilation of the same patterns.
 * Also provides a safety check for user-supplied patterns to prevent ReDoS.
 */

const regexCache = new Map<string, RegExp>();

/** Returns a cached RegExp instance for the given pattern and flags. */
export function getCachedRegex(pattern: string, flags?: string): RegExp {
  const key = `${pattern}\0${flags ?? ""}`;
  let cached = regexCache.get(key);
  if (!cached) {
    cached = new RegExp(pattern, flags);
    regexCache.set(key, cached);
  }
  return cached;
}

/**
 * Checks whether a user-supplied regex pattern is safe from ReDoS.
 * Rejects patterns with nested quantifiers and excessive length.
 */
export function isSafePattern(pattern: string): boolean {
  if (pattern.length > 200) return false;
  // Reject nested quantifiers: a common ReDoS trigger like (a+)+ or (a*)*
  if (/([+*}])\s*\)?\s*[+*{]/.test(pattern)) return false;
  return true;
}

/** Clears the regex cache (useful for testing). */
export function clearRegexCache(): void {
  regexCache.clear();
}
