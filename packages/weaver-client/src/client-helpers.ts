import { matchGlob } from "@weaver-conf/config-engine";

export { matchGlob };

export function applyNamespace(
  namespace: string | undefined,
  key: string,
): string {
  if (!namespace) return key;
  if (key.startsWith("/")) return key.slice(1);
  return `${namespace}.${key}`;
}
