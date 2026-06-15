import { isConfigMount } from "@weaver-conf/config-types";

export interface MountResolution {
  value: unknown;
  chain: string[];
}

export interface MountError {
  type: "cycle" | "max-depth";
  chain: string[];
}

export type MountResult =
  | { ok: true; resolution: MountResolution }
  | { ok: false; error: MountError };

/** Scan entries for ConfigMount markers, return a map of key -> source key. */
export function buildMountMap(
  entries: Record<string, unknown>,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();

  function scan(obj: Record<string, unknown>, prefix: string) {
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (isConfigMount(v)) {
        map.set(fullKey, v.source);
      } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        scan(v as Record<string, unknown>, fullKey);
      }
    }
  }

  scan(entries, "");
  return map;
}

/** Resolve a key through mount chain. Returns the final value or an error. */
export function resolveMountedValue(
  key: string,
  mountMap: ReadonlyMap<string, string>,
  getValue: (key: string) => unknown,
  maxDepth = 3,
): MountResult {
  const chain: string[] = [key];
  let current = key;

  for (let depth = 0; depth < maxDepth; depth++) {
    const source = mountMap.get(current);
    if (!source) {
      return { ok: true, resolution: { value: getValue(current), chain } };
    }
    if (chain.includes(source)) {
      return { ok: false, error: { type: "cycle", chain: [...chain, source] } };
    }
    chain.push(source);
    current = source;
  }

  // After loop exhaustion, check if current is a terminal
  if (!mountMap.has(current)) {
    return { ok: true, resolution: { value: getValue(current), chain } };
  }

  return { ok: false, error: { type: "max-depth", chain } };
}

/** Resolve all keys in a namespace, following mounts. */
export function resolveMountedNamespace(
  prefix: string,
  mountMap: ReadonlyMap<string, string>,
  getNamespace: (prefix: string) => Record<string, unknown>,
  getValue: (key: string) => unknown,
  maxDepth = 3,
): Record<string, unknown> {
  const entries = getNamespace(prefix);
  const result: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(entries)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (isConfigMount(v)) {
      const resolved = resolveMountedValue(fullKey, mountMap, getValue, maxDepth);
      result[k] = resolved.ok ? resolved.resolution.value : undefined;
    } else {
      result[k] = v;
    }
  }

  return result;
}
