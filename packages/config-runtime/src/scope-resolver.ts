import { deepGet, deepMerge } from "@weaver-conf/config-engine";
import type {
  ConfigurationLayerEntry,
  ConfigurationLayerStack,
  ScopeInstance,
  ScopeResolutionCache,
  WeaverConfig,
} from "@weaver-conf/config-types";
import { serializeScopePath } from "@weaver-conf/config-types";

export interface ScopeResolverOptions {
  /** Retrieve raw entries for a named layer. */
  getLayerEntries: (layer: string) => Record<string, unknown>;
  weaverConfig: WeaverConfig;
  cacheSize?: number;
}

export interface ScopeResolver {
  getForScope<T = unknown>(
    key: string,
    scopePath: ScopeInstance[],
  ): T | undefined;
  invalidate(): void;
  buildScopedStack(scopePath: ScopeInstance[]): ConfigurationLayerStack;
}

/** Simple LRU cache for scope resolution results. */
export function createScopeCache(maxSize = 100): ScopeResolutionCache {
  const entries = new Map<string, Record<string, unknown>>();
  const order: string[] = [];

  return {
    get(scopeKey: string): Record<string, unknown> | undefined {
      const value = entries.get(scopeKey);
      if (value !== undefined) {
        const idx = order.indexOf(scopeKey);
        if (idx > 0) {
          order.splice(idx, 1);
          order.unshift(scopeKey);
        }
      }
      return value;
    },

    set(scopeKey: string, data: Record<string, unknown>): void {
      if (entries.has(scopeKey)) {
        entries.set(scopeKey, data);
        const idx = order.indexOf(scopeKey);
        if (idx > 0) {
          order.splice(idx, 1);
          order.unshift(scopeKey);
        }
        return;
      }
      // Evict LRU if at capacity
      while (order.length >= maxSize) {
        const evicted = order.pop();
        if (evicted) entries.delete(evicted);
      }
      entries.set(scopeKey, data);
      order.unshift(scopeKey);
    },

    clear(): void {
      entries.clear();
      order.length = 0;
    },
  };
}

export function createScopeResolver(
  options: ScopeResolverOptions,
): ScopeResolver {
  const { getLayerEntries, weaverConfig, cacheSize = 100 } = options;
  const cache = createScopeCache(cacheSize);

  function classifyLayers() {
    const baseLayers: string[] = [];
    const dynamicLayers: string[] = [];

    for (const layerDef of weaverConfig.layers) {
      if (layerDef.type.id === "dynamic") {
        dynamicLayers.push(layerDef.name);
      } else {
        baseLayers.push(layerDef.name);
      }
    }

    return { baseLayers, dynamicLayers };
  }

  function buildScopedStack(
    scopePath: ScopeInstance[],
  ): ConfigurationLayerStack {
    const layers: ConfigurationLayerEntry[] = [];
    const { baseLayers } = classifyLayers();

    // Add base layers in rank order
    for (const layerName of baseLayers) {
      const rank = weaverConfig.getRank(layerName);
      if (rank < 0) continue;
      const layerEntries = getLayerEntries(layerName);
      layers.push({ layer: layerName, entries: layerEntries });
    }

    // Insert scope layers in order
    for (const scope of scopePath) {
      const scopeLayerName = `${scope.scopeId}:${scope.value}`;
      const layerEntries = getLayerEntries(scopeLayerName);
      layers.push({ layer: scopeLayerName, entries: layerEntries });
    }

    return { layers };
  }

  function resolveForScope(
    scopePath: ScopeInstance[],
  ): Record<string, unknown> {
    const cacheKey = serializeScopePath(scopePath);
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const stack = buildScopedStack(scopePath);
    let merged: Record<string, unknown> = {};
    for (const layer of stack.layers) {
      merged = deepMerge(merged, layer.entries);
    }

    cache.set(cacheKey, merged);
    return merged;
  }

  return {
    getForScope<T = unknown>(
      key: string,
      scopePath: ScopeInstance[],
    ): T | undefined {
      const resolved = resolveForScope(scopePath);
      return deepGet(resolved, key) as T | undefined;
    },

    invalidate(): void {
      cache.clear();
    },

    buildScopedStack,
  };
}
