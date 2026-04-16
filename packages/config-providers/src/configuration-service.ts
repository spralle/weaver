// Configuration service factory — composes providers, state container, and engine

import type {
  ConfigurationService,
  ConfigurationStorageProvider,
  ConfigurationLayer,
  ConfigurationInspection,
  ConfigurationLayerStack,
  ConfigurationSessionHandle,
  WeaverConfig,
} from "@weaver/config-types";
import type { ScopeInstance } from "@weaver/config-types";
import { resolveConfiguration, inspectKey } from "@weaver/config-engine";
import { createStateContainer } from "./state-container.js";
import type { ConfigurationStateContainer } from "./state-container.js";
import type { OverrideSessionController } from "@weaver/config-sessions";

export interface ConfigurationServiceOptions {
  providers: ConfigurationStorageProvider[];
  weaverConfig: WeaverConfig;
  session?: OverrideSessionController | undefined;
  onWriteError?: ((error: unknown, context: { key: string; layer: string; operation: 'write' | 'remove' }) => void) | undefined;
}

/**
 * Creates a ConfigurationService by loading all providers, building the state
 * container, and wiring change notifications.
 *
 * Async because provider.load() is async.
 */
export async function createConfigurationService(
  options: ConfigurationServiceOptions,
): Promise<ConfigurationService> {
  const { weaverConfig } = options;

  // Compute a rank for unknown (runtime scope) layers.
  // They should sort after the last dynamic layer but before the next known layer.
  const dynamicLayers = weaverConfig.getLayersByType("dynamic");
  let unknownLayerRank: number;
  if (dynamicLayers.length > 0) {
    const maxDynRank = Math.max(...dynamicLayers.map((dl) => weaverConfig.getRank(dl.name)));
    unknownLayerRank = maxDynRank + 0.5;
  } else {
    // No dynamic layers — unknown layers sort after all known layers
    unknownLayerRank = weaverConfig.layerNames.length + 0.5;
  }

  const getRank = (layer: string): number => {
    const r = weaverConfig.getRank(layer);
    return r >= 0 ? r : unknownLayerRank;
  };

  const container = createStateContainer(getRank);

  // When a session controller is provided, auto-register its provider
  const allProviders = options.session !== undefined
    ? [...options.providers, options.session.provider]
    : [...options.providers];

  // Sort providers by layer rank for deterministic load order
  const sortedProviders = allProviders.sort(
    (a, b) => getRank(a.layer) - getRank(b.layer),
  );

  // Load each provider and apply to state container
  for (const provider of sortedProviders) {
    const data = await provider.load();
    container.applyLayerData(provider.layer, data.entries);
  }

  // Wire external change listeners
  for (const provider of sortedProviders) {
    if (provider.onExternalChange !== undefined) {
      provider.onExternalChange((changes) => {
        const currentEntries = container.getLayerEntries(provider.layer);
        for (const change of changes) {
          if (change.newValue === undefined) {
            delete currentEntries[change.key];
          } else {
            currentEntries[change.key] = change.newValue;
          }
        }
        container.applyLayerData(provider.layer, currentEntries);
      });
    }
  }

  // Provider lookup helpers
  function findProviderForLayer(
    layer: ConfigurationLayer | string,
  ): ConfigurationStorageProvider | undefined {
    return sortedProviders.find((p) => p.layer === layer);
  }

  function findHighestWritableProvider(): ConfigurationStorageProvider | undefined {
    // Iterate from highest rank to lowest
    const reversed = [...sortedProviders].reverse();
    return reversed.find((p) => p.writable);
  }

  function buildLayerStack(): ConfigurationLayerStack {
    return {
      layers: sortedProviders.map((p) => ({
        layer: p.layer,
        entries: container.getLayerEntries(p.layer),
      })),
    };
  }

  interface ClassifiedLayers {
    fixedBase: Array<{ layer: string; entries: Record<string, unknown> }>;
    scopeEntries: Map<string, Record<string, unknown>>;
    fixedTop: Array<{ layer: string; entries: Record<string, unknown> }>;
  }

  function classifyProviderLayers(): ClassifiedLayers {
    const fixedBase: ClassifiedLayers["fixedBase"] = [];
    const fixedTop: ClassifiedLayers["fixedBase"] = [];
    const scopeEntries = new Map<string, Record<string, unknown>>();

    const dynLayers = weaverConfig.getLayersByType("dynamic");
    const maxDynRank = dynLayers.length > 0
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

  function buildScopedLayerStack(scopePath: ScopeInstance[]): ConfigurationLayerStack {
    const { fixedBase, scopeEntries, fixedTop } = classifyProviderLayers();

    const orderedScopeLayers = scopePath
      .map((scope) => `${scope.scopeId}:${scope.value}`)
      .map((layerId) => {
        const entries = scopeEntries.get(layerId);
        return entries !== undefined ? { layer: layerId, entries } : undefined;
      })
      .filter((layer): layer is { layer: string; entries: Record<string, unknown> } => {
        return layer !== undefined;
      });

    return {
      layers: [...fixedBase, ...orderedScopeLayers, ...fixedTop],
    };
  }

  // Expose session handle when session controller was provided
  const sessionHandle: ConfigurationSessionHandle | undefined =
    options.session !== undefined ? options.session : undefined;

  return {
    get<T>(key: string): T | undefined {
      return container.get(key) as T | undefined;
    },

    getWithDefault<T>(key: string, defaultValue: T): T {
      const value = container.get(key) as T | undefined;
      return value !== undefined ? value : defaultValue;
    },

    getAtLayer<T>(
      layer: ConfigurationLayer | string,
      key: string,
    ): T | undefined {
      const entries = container.getLayerEntries(layer);
      return entries[key] as T | undefined;
    },

    getForScope<T>(
      key: string,
      scopePath: ScopeInstance[],
    ): T | undefined {
      const stack = buildScopedLayerStack(scopePath);
      const resolved = resolveConfiguration(stack);
      return resolved.entries[key] as T | undefined;
    },

    inspect<T>(key: string): ConfigurationInspection<T> {
      const stack = buildLayerStack();
      return inspectKey<T>(stack, key);
    },

    set(key: string, value: unknown, layer?: ConfigurationLayer): void {
      let provider: ConfigurationStorageProvider | undefined;

      if (layer !== undefined) {
        provider = findProviderForLayer(layer);
      } else {
        provider = findHighestWritableProvider();
      }

      if (provider === undefined || !provider.writable) {
        throw new Error(
          layer !== undefined
            ? `No writable provider for layer "${layer}"`
            : "No writable provider available",
        );
      }

      // Fire-and-forget the async write; update container synchronously
      provider.write(key, value).catch((error: unknown) => {
        options.onWriteError?.(error, { key, layer: provider.layer, operation: 'write' });
      });

      const updated = {
        ...container.getLayerEntries(provider.layer),
        [key]: value,
      };
      container.applyLayerData(provider.layer, updated);
    },

    remove(key: string, layer: ConfigurationLayer): void {
      const provider = findProviderForLayer(layer);

      if (provider === undefined || !provider.writable) {
        throw new Error(`No writable provider for layer "${layer}"`);
      }

      provider.remove(key).catch((error: unknown) => {
        options.onWriteError?.(error, { key, layer: provider.layer, operation: 'remove' });
      });

      const updated = container.getLayerEntries(provider.layer);
      delete updated[key];
      container.applyLayerData(provider.layer, updated);
    },

    onChange(key: string, listener: (value: unknown) => void): () => void {
      return container.onChange(key, listener);
    },

    getNamespace(prefix: string): Record<string, unknown> {
      return container.getNamespace(prefix);
    },

    session: sessionHandle,
  };
}
