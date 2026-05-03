// Mount resolution — follows ConfigMount indirections to resolve final values

import { isConfigMount } from "@weaver/config-types";

/** Result of resolving a key through the mount chain */
export interface MountResolution {
  /** The final resolved value (after following all mounts) */
  readonly value: unknown;
  /** Path of keys followed: [originalKey, ...intermediateKeys, finalKey] */
  readonly chain: readonly string[];
  /** Whether mount indirection was used */
  readonly isMounted: boolean;
}

/** Default maximum mount chain depth */
const MAX_MOUNT_DEPTH = 3;

/**
 * Scans entries for ConfigMount markers and builds a key → source map.
 * Only top-level values that are ConfigMount are included.
 */
export function buildMountMap(
  entries: Readonly<Record<string, unknown>>,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(entries)) {
    if (isConfigMount(value)) {
      map.set(key, value.source);
    }
  }
  return map;
}

/**
 * Resolves a key through the mount chain.
 * If the value at `key` is a ConfigMount, follows source. Repeats until
 * a non-mount value is found or limits are hit.
 *
 * @throws Error if cycle detected or max depth exceeded
 */
export function resolveMountedValue(
  key: string,
  mountMap: ReadonlyMap<string, string>,
  getRawValue: (key: string) => unknown,
  maxDepth: number = MAX_MOUNT_DEPTH,
): MountResolution {
  if (!mountMap.has(key)) {
    return { value: getRawValue(key), chain: [key], isMounted: false };
  }

  const chain: string[] = [key];
  const visited = new Set<string>([key]);
  let currentKey = key;

  for (let depth = 0; depth < maxDepth; depth++) {
    const source = mountMap.get(currentKey);
    if (source === undefined) {
      return { value: getRawValue(currentKey), chain, isMounted: true };
    }

    if (visited.has(source)) {
      throw new Error(
        `Mount cycle detected: ${[...chain, source].join(" → ")}`,
      );
    }

    visited.add(source);
    chain.push(source);
    currentKey = source;
  }

  if (mountMap.has(currentKey)) {
    throw new Error(
      `Mount chain exceeded maximum depth (${String(maxDepth)}): ${chain.join(" → ")}`,
    );
  }

  return { value: getRawValue(currentKey), chain, isMounted: true };
}

/**
 * Resolves a namespace with mount awareness.
 * For each key in the raw namespace result, resolves through mount chain.
 * On mount resolution error (cycle/depth), returns the raw mount marker.
 */
export function resolveMountedNamespace(
  prefix: string,
  mountMap: ReadonlyMap<string, string>,
  getRawNamespace: (prefix: string) => Record<string, unknown>,
  getRawValue: (key: string) => unknown,
  maxDepth: number = MAX_MOUNT_DEPTH,
): Record<string, unknown> {
  const raw = getRawNamespace(prefix);
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(raw)) {
    if (!mountMap.has(key)) {
      result[key] = raw[key];
      continue;
    }
    try {
      const resolution = resolveMountedValue(
        key,
        mountMap,
        getRawValue,
        maxDepth,
      );
      result[key] = resolution.value;
    } catch {
      result[key] = raw[key];
    }
  }

  return result;
}
