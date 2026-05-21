import { getCachedRegex } from "@weaver/config-engine";

export function matchGlob(pattern: string, key: string): boolean {
  const regex = getCachedRegex(
    "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, "[^.]*") + "$",
  );
  return regex.test(key);
}

export function applyNamespace(namespace: string | undefined, key: string): string {
  if (!namespace) return key;
  if (key.startsWith("/")) return key.slice(1);
  return `${namespace}.${key}`;
}
