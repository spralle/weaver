// Configuration service factory — composes providers, state container, and engine

import type {
  ConfigurationService,
  ConfigurationStorageProvider,
  ConfigurationLayer,
  ConfigurationInspection,
  ConfigurationLayerStack,
  ConfigurationSessionHandle,
} from "@weaver/config-types";
import type { ScopeInstance } from "@weaver/config-types";
import { resolveConfiguration, inspectKey } from "@weaver/config-engine";
import { createStateContainer } from "./state-container.js";
import type { ConfigurationStateContainer } from "./state-container.js";
import type { GodModeSessionController } from "./session-provider.js";

const LAYER_RANK: Record<string, number> = {
  core: 0,
  app: 1,
  module: 2,
  integrator: 3,
  tenant: 4,
  user: 5,
  device: 6,
  session: 7,
};

function getLayerRank(layer: string): number {
  const rank = LAYER_RANK[layer];
  return rank !== undefined ? rank : 4.5;
}

export interface ConfigurationServiceOptions {
  providers: ConfigurationStorageProvider[];
  session?: GodModeSessionController | undefined;
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
  const container = createStateContainer();

  // When a session controller is provided, auto-register its provider
  const allProviders = options.session !== undefined
    ? [...options.providers, options.session.provider]
    : [...options.providers];

  // Sort providers by layer rank for deterministic load order
  const sortedProviders = allProviders.sort(
    (a, b) => getLayerRank(a.layer) - getLayerRank(b.layer),
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

  function buildScopedLayerStack(scopePath: ScopeInstance[]): ConfigurationLayerStack {
    const fixedBaseLayers: Array<{ layer: string; entries: Record<string, unknown> }> = [];
    const fixedTopLayers: Array<{ layer: string; entries: Record<string, unknown> }> = [];
    const scopeLayerEntries = new Map<string, Record<string, unknown>>();

    for (const provider of sortedProviders) {
      const entries = container.getLayerEntries(provider.layer);
      const rank = getLayerRank(provider.layer);

      if (rank <= getLayerRank("tenant")) {
        fixedBaseLayers.push({ layer: provider.layer, entries });
        continue;
      }

      if (rank >= getLayerRank("user")) {
        fixedTopLayers.push({ layer: provider.layer, entries });
        continue;
      }

      scopeLayerEntries.set(provider.layer, entries);
    }

    const orderedScopeLayers = scopePath
      .map((scope) => `${scope.scopeId}:${scope.value}`)
      .map((layerId) => {
        const entries = scopeLayerEntries.get(layerId);
        return entries !== undefined ? { layer: layerId, entries } : undefined;
      })
      .filter((layer): layer is { layer: string; entries: Record<string, unknown> } => {
        return layer !== undefined;
      });

    return {
      layers: [...fixedBaseLayers, ...orderedScopeLayers, ...fixedTopLayers],
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
      void provider.write(key, value);

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

      void provider.remove(key);

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
