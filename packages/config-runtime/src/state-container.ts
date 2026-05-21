import {
  cloneValue,
  deepGet,
  deepMerge,
  deepRemove,
  deepSet,
} from "@weaver/config-engine";
import { createSubscriptionManager } from "./subscriptions.js";
import type {
  ConfigDelta,
  LayerEntry,
  StateContainer,
  StateSnapshot,
  Unsubscribe,
} from "./types.js";

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
    return resolved;
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
    const changedPaths = new Set<string>();
    const mutable = cloneValue(resolved) as Record<string, unknown>;

    if (delta.set) {
      for (const [path, value] of Object.entries(delta.set)) {
        deepSet(mutable, path, value);
        changedPaths.add(path);
      }
    }
    if (delta.removed) {
      for (const path of delta.removed) {
        deepRemove(mutable, path);
        changedPaths.add(path);
      }
    }

    resolved = mutable;
    revision = delta.revision;

    if (changedPaths.size > 0) {
      subs.notify(changedPaths, (p) => deepGet(resolved, p), resolved);
    }
  }

  function snapshot(): StateSnapshot {
    return {
      resolved: cloneValue(resolved) as Record<string, unknown>,
      provenance: { ...provenance },
      revision,
    };
  }

  function hydrate(snap: StateSnapshot): void {
    const previous = resolved;
    resolved = cloneValue(snap.resolved) as Record<string, unknown>;
    provenance = { ...snap.provenance };
    revision = snap.revision;

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
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
      changed.add(key);
    }
  }
  return changed;
}
