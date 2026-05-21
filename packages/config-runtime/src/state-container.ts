import {
  cloneValue,
  deepGet,
  deepMerge,
  deepRemove,
  deepSet,
} from "@weaver/config-engine";
import { createSubscriptionManager } from "./subscriptions.js";
import {
  type ConfigDelta,
  ConfigDeltaSchema,
  type LayerEntry,
  type StateContainer,
  type StateSnapshot,
  StateSnapshotSchema,
  type Unsubscribe,
} from "./types.js";

/**
 * Creates a reactive state container that resolves config from prioritized layers.
 * Supports subscriptions, delta application, and snapshot hydration.
 *
 * @param options - Optional initial layers to seed the container
 */
export function createStateContainer(options?: {
  layers?: LayerEntry[];
}): StateContainer {
  const layers: LayerEntry[] = [...(options?.layers ?? [])];
  const subs = createSubscriptionManager();
  let resolved: Record<string, unknown> = {};
  let provenance: Record<string, string> = {};
  let revision = 0;

  function resolve(): void {
    const previous = resolved;
    layers.sort((a, b) => a.priority - b.priority);

    let merged: Record<string, unknown> = {};
    const newProvenance: Record<string, string> = {};

    for (const layer of layers) {
      const mergeFn = layer.merge ?? deepMerge;
      merged = mergeFn(merged, layer.entries);
      // Track provenance for top-level keys provided by this layer
      for (const key of Object.keys(layer.entries)) {
        if (layer.entries[key] !== undefined) {
          newProvenance[key] = layer.id;
        }
      }
    }

    resolved = merged;
    provenance = newProvenance;
    revision++;

    const changedPaths = diffTopLevelKeys(previous, resolved);
    if (changedPaths.size > 0) {
      subs.notify(changedPaths, (p) => deepGet(resolved, p), resolved);
    }
  }

  function get(path: string): unknown {
    return deepGet(resolved, path);
  }

  function getAll(): Record<string, unknown> {
    return cloneValue(resolved) as Record<string, unknown>; // SAFETY: resolved is always Record<string, unknown>
  }

  function subscribe(
    path: string,
    callback: (value: unknown) => void,
  ): Unsubscribe {
    return subs.subscribePath(path, callback);
  }

  function subscribeAll(
    callback: (r: Record<string, unknown>) => void,
  ): Unsubscribe {
    return subs.subscribeAll(callback);
  }

  function applyDelta(delta: ConfigDelta): void {
    const parsed = ConfigDeltaSchema.parse(delta);
    const changedPaths = new Set<string>();
    const mutable = cloneValue(resolved) as Record<string, unknown>; // SAFETY: resolved is always Record<string, unknown>

    if (parsed.set) {
      for (const [path, value] of Object.entries(parsed.set)) {
        deepSet(mutable, path, value);
        changedPaths.add(path);
      }
    }
    if (parsed.removed) {
      for (const path of parsed.removed) {
        deepRemove(mutable, path);
        changedPaths.add(path);
      }
    }

    resolved = mutable;
    revision = parsed.revision;

    if (changedPaths.size > 0) {
      subs.notify(changedPaths, (p) => deepGet(resolved, p), resolved);
    }
  }

  function snapshot(): StateSnapshot {
    return {
      resolved: cloneValue(resolved) as Record<string, unknown>, // SAFETY: resolved is always Record<string, unknown>
      provenance: { ...provenance },
      revision,
    };
  }

  function hydrate(snap: StateSnapshot): void {
    const parsed = StateSnapshotSchema.parse(snap);
    const previous = resolved;
    resolved = cloneValue(parsed.resolved) as Record<string, unknown>; // SAFETY: parsed.resolved is Record<string, unknown>
    provenance = { ...parsed.provenance };
    revision = parsed.revision;

    const changedPaths = diffTopLevelKeys(previous, resolved);
    if (changedPaths.size > 0) {
      subs.notify(changedPaths, (p) => deepGet(resolved, p), resolved);
    }
  }

  function setLayer(layer: LayerEntry): void {
    const idx = layers.findIndex((l) => l.id === layer.id);
    if (idx >= 0) {
      layers[idx] = layer;
    } else {
      layers.push(layer);
    }
    resolve();
  }

  function removeLayer(id: string): void {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx >= 0) {
      layers.splice(idx, 1);
      resolve();
    }
  }

  function getProvenance(path: string): string | undefined {
    const topKey = path.split(".")[0] ?? path;
    return provenance[topKey];
  }

  // Initial resolution
  if (layers.length > 0) {
    resolve();
  }

  return {
    resolve,
    get,
    getAll,
    subscribe,
    subscribeAll,
    applyDelta,
    snapshot,
    hydrate,
    setLayer,
    removeLayer,
    getProvenance,
    get revision() {
      return revision;
    },
  };
}

/** Diff two objects and return set of top-level keys that changed */
function diffTopLevelKeys(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): Set<string> {
  const changed = new Set<string>();
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of allKeys) {
    if (prev[key] !== next[key] && !deepEqual(prev[key], next[key])) {
      changed.add(key);
    }
  }
  return changed;
}

/** Recursive structural equality for JSON-serializable values (no Date/Symbol/Map support). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aObj = a as Record<string, unknown>; // SAFETY: both confirmed non-null objects above
  const bObj = b as Record<string, unknown>; // SAFETY: both confirmed non-null objects above
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }
  return true;
}
