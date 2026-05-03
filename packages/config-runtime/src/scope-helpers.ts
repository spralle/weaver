// Scope resolution helpers — extracted from configuration-service for file size compliance

import type {
  ConfigurationLayerStack,
  ConfigurationStorageProvider,
  ScopeInstance,
  WeaverConfig,
} from "@weaver/config-types";
import type { ConfigurationStateContainer } from "./state-container.js";

export interface ClassifiedLayers {
  fixedBase: Array<{ layer: string; entries: Record<string, unknown> }>;
  scopeEntries: Map<string, Record<string, unknown>>;
  fixedTop: Array<{ layer: string; entries: Record<string, unknown> }>;
}

/**
 * Classifies provider layers into fixed-base, scope (dynamic/unknown), and fixed-top buckets.
 */
export function classifyProviderLayers(
  sortedProviders: ConfigurationStorageProvider[],
  container: ConfigurationStateContainer,
  weaverConfig: WeaverConfig,
  getRank: (layer: string) => number,
): ClassifiedLayers {
  const fixedBase: ClassifiedLayers["fixedBase"] = [];
  const fixedTop: ClassifiedLayers["fixedBase"] = [];
  const scopeEntries = new Map<string, Record<string, unknown>>();

  const dynLayers = weaverConfig.getLayersByType("dynamic");
  const maxDynRank =
    dynLayers.length > 0
      ? Math.max(...dynLayers.map((dl) => getRank(dl.name)))
      : -Infinity;
  const hasDynLayers = dynLayers.length > 0;

  for (const provider of sortedProviders) {
    const entries = container.getLayerEntries(provider.layer);

    if (!weaverConfig.rankMap.has(provider.layer)) {
      scopeEntries.set(provider.layer, entries);
      continue;
    }

    const rank = getRank(provider.layer);

    if (!hasDynLayers || rank <= maxDynRank) {
      fixedBase.push({ layer: provider.layer, entries });
    } else {
      fixedTop.push({ layer: provider.layer, entries });
    }
  }

  return { fixedBase, scopeEntries, fixedTop };
}

/**
 * Builds a scoped layer stack by inserting scope-specific layers between fixed base and top.
 */
export function buildScopedLayerStack(
  scopePath: ScopeInstance[],
  sortedProviders: ConfigurationStorageProvider[],
  container: ConfigurationStateContainer,
  weaverConfig: WeaverConfig,
  getRank: (layer: string) => number,
): ConfigurationLayerStack {
  const { fixedBase, scopeEntries, fixedTop } = classifyProviderLayers(
    sortedProviders,
    container,
    weaverConfig,
    getRank,
  );

  const orderedScopeLayers = scopePath
    .map((scope) => `${scope.scopeId}:${scope.value}`)
    .map((layerId) => {
      const entries = scopeEntries.get(layerId);
      return entries !== undefined ? { layer: layerId, entries } : undefined;
    })
    .filter(
      (layer): layer is { layer: string; entries: Record<string, unknown> } => {
        return layer !== undefined;
      },
    );

  return {
    layers: [...fixedBase, ...orderedScopeLayers, ...fixedTop],
  };
}
