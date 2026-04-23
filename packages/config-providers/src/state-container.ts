// Internal state container — holds resolved config state with change notification

import { resolveConfiguration } from "@weaver/config-engine";
import type { ConfigurationLayerStack } from "@weaver/config-types";

export interface ConfigurationStateContainer {
  /** Get the resolved value for a key */
  get(key: string): unknown;
  /** Get all keys under a prefix */
  getNamespace(prefix: string): Record<string, unknown>;
  /** Get the layer that provided the effective value for a key */
  getProvenance(key: string): string | undefined;
  /** Apply layer data — re-resolves, emits changes only for keys that actually changed */
  applyLayerData(layer: string, entries: Record<string, unknown>): void;
  /** Listen for changes to a specific key */
  onChange(key: string, listener: (newValue: unknown) => void): () => void;
  /** Listen for all changes (wildcard) */
  onAnyChange(
    listener: (changes: Array<{ key: string; newValue: unknown }>) => void,
  ): () => void;
  /** Frozen snapshot of current state */
  snapshot(): Readonly<Record<string, unknown>>;
  /** Get raw entries for a specific layer (before merge) */
  getLayerEntries(layer: string): Record<string, unknown>;
}

export function createStateContainer(
  getRank: (layer: string) => number,
): ConfigurationStateContainer {
  const rawLayers = new Map<string, Record<string, unknown>>();
  let resolvedEntries: Record<string, unknown> = {};
  let provenance = new Map<string, string>();

  const keyListeners = new Map<string, Set<(newValue: unknown) => void>>();
  const globalListeners = new Set<
    (changes: Array<{ key: string; newValue: unknown }>) => void
  >();

  function buildStack(): ConfigurationLayerStack {
    const sorted = [...rawLayers.entries()].sort(
      (a, b) => getRank(a[0]) - getRank(b[0]),
    );
    return {
      layers: sorted.map(([layer, entries]) => ({ layer, entries })),
    };
  }

  function resolve(): void {
    const stack = buildStack();
    const result = resolveConfiguration(stack);
    const oldEntries = resolvedEntries;

    resolvedEntries = result.entries;
    provenance = result.provenance;

    // Compute changed keys
    const allKeys = new Set([
      ...Object.keys(oldEntries),
      ...Object.keys(resolvedEntries),
    ]);

    const changes: Array<{ key: string; newValue: unknown }> = [];
    for (const key of allKeys) {
      const oldVal = JSON.stringify(oldEntries[key]);
      const newVal = JSON.stringify(resolvedEntries[key]);
      if (oldVal !== newVal) {
        changes.push({ key, newValue: resolvedEntries[key] });
      }
    }

    if (changes.length === 0) return;

    // Fire per-key listeners
    for (const change of changes) {
      const listeners = keyListeners.get(change.key);
      if (listeners !== undefined) {
        for (const listener of listeners) {
          listener(change.newValue);
        }
      }
    }

    // Fire global change listeners
    for (const listener of globalListeners) {
      listener(changes);
    }
  }

  return {
    get(key: string): unknown {
      return resolvedEntries[key];
    },

    getNamespace(prefix: string): Record<string, unknown> {
      const dotPrefix = `${prefix}.`;
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(resolvedEntries)) {
        if (key.startsWith(dotPrefix)) {
          result[key] = resolvedEntries[key];
        }
      }
      return result;
    },

    getProvenance(key: string): string | undefined {
      return provenance.get(key);
    },

    applyLayerData(layer: string, entries: Record<string, unknown>): void {
      rawLayers.set(layer, { ...entries });
      resolve();
    },

    onChange(key: string, listener: (newValue: unknown) => void): () => void {
      let listeners = keyListeners.get(key);
      if (listeners === undefined) {
        listeners = new Set();
        keyListeners.set(key, listeners);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          keyListeners.delete(key);
        }
      };
    },

    onAnyChange(
      listener: (changes: Array<{ key: string; newValue: unknown }>) => void,
    ): () => void {
      globalListeners.add(listener);
      return () => {
        globalListeners.delete(listener);
      };
    },

    snapshot(): Readonly<Record<string, unknown>> {
      return Object.freeze({ ...resolvedEntries });
    },

    getLayerEntries(layer: string): Record<string, unknown> {
      const entries = rawLayers.get(layer);
      return entries !== undefined ? { ...entries } : {};
    },
  };
}
