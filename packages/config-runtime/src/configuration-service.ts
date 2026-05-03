// Configuration service factory — composes providers, state container, and engine
import type { ZodType } from "zod";
import { inspectKey, resolveConfiguration } from "@weaver/config-engine";
import type { OverrideSessionController } from "@weaver/config-sessions";
import type {
  ConfigurationInspection,
  ConfigurationLayer,
  ConfigurationLayerStack,
  ConfigurationService,
  ConfigurationSessionHandle,
  ConfigurationStorageProvider,
  ScopeInstance,
  ScopeResolutionCache,
  WeaverConfig,
} from "@weaver/config-types";
import { createWeaverError, serializeScopePath } from "@weaver/config-types";
import {
  buildMountMap,
  resolveMountedNamespace,
  resolveMountedValue,
} from "./mount-resolver.js";
import { buildScopedLayerStack } from "./scope-helpers.js";
import type {
  SecretIntegrationHandle,
  SecretIntegrationOptions,
} from "./secret-integration.js";
import { createSecretIntegration } from "./secret-integration.js";
import { createStateContainer } from "./state-container.js";

export interface ConfigurationServiceOptions {
  providers: ConfigurationStorageProvider[];
  weaverConfig: WeaverConfig;
  session?: OverrideSessionController | undefined;
  scopeCache?: ScopeResolutionCache | undefined;
  /** Optional secret resolution for transparent SecretReference resolution */
  secrets?: SecretIntegrationOptions | undefined;
  onWriteError?:
    | ((
        error: unknown,
        context: { key: string; layer: string; operation: "write" | "remove" },
      ) => void)
    | undefined;
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
  const dynamicLayers = weaverConfig.getLayersByType("dynamic");
  let unknownLayerRank: number;
  if (dynamicLayers.length > 0) {
    const maxDynRank = Math.max(
      ...dynamicLayers.map((dl) => weaverConfig.getRank(dl.name)),
    );
    unknownLayerRank = maxDynRank + 0.5;
  } else {
    unknownLayerRank = weaverConfig.layerNames.length + 0.5;
  }

  const getRank = (layer: string): number => {
    const r = weaverConfig.getRank(layer);
    return r >= 0 ? r : unknownLayerRank;
  };

  const container = createStateContainer(getRank);

  // When a session controller is provided, auto-register its provider
  const allProviders =
    options.session !== undefined
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
    options.scopeCache?.clear();
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
        options.scopeCache?.clear();
      });
    }
  }

  // Build mount map for resolving ConfigMount markers
  let mountMap = buildMountMap(container.snapshot());
  container.onAnyChange(() => {
    mountMap = buildMountMap(container.snapshot());
  });

  // Secret resolution: pre-resolve all SecretReference entries
  let secretHandle: SecretIntegrationHandle | undefined;
  if (options.secrets !== undefined) {
    secretHandle = await createSecretIntegration(
      container.snapshot(),
      options.secrets,
    );
    container.onAnyChange(() => {
      secretHandle
        ?.refresh(container.snapshot())
        .catch(options.secrets?.onRefreshError ?? (() => {}));
    });
  }

  // Provider lookup helpers
  function findProviderForLayer(
    layer: ConfigurationLayer | string,
  ): ConfigurationStorageProvider | undefined {
    return sortedProviders.find((p) => p.layer === layer);
  }

  function findHighestWritableProvider():
    | ConfigurationStorageProvider
    | undefined {
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

  // Expose session handle when session controller was provided
  const sessionHandle: ConfigurationSessionHandle | undefined =
    options.session !== undefined ? options.session : undefined;

  return {
    get<T>(key: string, schema?: ZodType<T>): T | undefined {
      let value: unknown;
      if (secretHandle?.hasSecret(key) === true) {
        value = secretHandle.getResolved(key);
      } else if (!mountMap.has(key)) {
        value = container.get(key);
      } else {
        try {
          const resolution = resolveMountedValue(key, mountMap, (k) =>
            container.get(k),
          );
          if (secretHandle !== undefined && resolution.isMounted) {
            const targetKey =
              resolution.chain[resolution.chain.length - 1] ?? key;
            if (secretHandle.hasSecret(targetKey)) {
              value = secretHandle.getResolved(targetKey);
            } else {
              value = resolution.value;
            }
          } else {
            value = resolution.value;
          }
        } catch {
          return undefined;
        }
      }
      if (schema !== undefined) {
        const result = schema.safeParse(value);
        return result.success ? result.data : undefined;
      }
      return value as T | undefined;
    },

    getWithDefault<T>(key: string, defaultValue: T): T {
      if (secretHandle?.hasSecret(key) === true) {
        const resolved = secretHandle.getResolved(key);
        return resolved !== undefined ? (resolved as T) : defaultValue;
      }
      if (!mountMap.has(key)) {
        const value = container.get(key) as T | undefined;
        return value !== undefined ? value : defaultValue;
      }
      try {
        const resolution = resolveMountedValue(key, mountMap, (k) =>
          container.get(k),
        );
        if (secretHandle !== undefined && resolution.isMounted) {
          const targetKey =
            resolution.chain[resolution.chain.length - 1] ?? key;
          if (secretHandle.hasSecret(targetKey)) {
            const resolved = secretHandle.getResolved(targetKey);
            return resolved !== undefined ? (resolved as T) : defaultValue;
          }
        }
        const value = resolution.value as T | undefined;
        return value !== undefined ? value : defaultValue;
      } catch {
        return defaultValue;
      }
    },

    getAtLayer<T>(
      layer: ConfigurationLayer | string,
      key: string,
    ): T | undefined {
      const entries = container.getLayerEntries(layer);
      return entries[key] as T | undefined;
    },

    getForScope<T>(key: string, scopePath: ScopeInstance[]): T | undefined {
      const cache = options.scopeCache;
      if (cache !== undefined) {
        const cacheKey = serializeScopePath(scopePath);
        const cached = cache.get(cacheKey);
        if (cached !== undefined) return cached[key] as T | undefined;
        const stack = buildScopedLayerStack(
          scopePath,
          sortedProviders,
          container,
          weaverConfig,
          getRank,
        );
        const resolved = resolveConfiguration(stack);
        cache.set(cacheKey, resolved.entries);
        return resolved.entries[key] as T | undefined;
      }
      const stack = buildScopedLayerStack(
        scopePath,
        sortedProviders,
        container,
        weaverConfig,
        getRank,
      );
      const resolved = resolveConfiguration(stack);
      return resolved.entries[key] as T | undefined;
    },

    inspect<T>(key: string): ConfigurationInspection<T> {
      const stack = buildLayerStack();
      const inspection = inspectKey<T>(stack, key);

      if (mountMap.has(key)) {
        try {
          const resolution = resolveMountedValue(key, mountMap, (k) =>
            container.get(k),
          );
          if (resolution.isMounted) {
            inspection.mountChain = resolution.chain;
            inspection.effectiveValue = resolution.value as T;
          }
        } catch {
          // Mount error — leave inspection as-is
        }
      }

      if (secretHandle?.hasSecret(key) === true) {
        const resolved = secretHandle.getResolved(key);
        if (resolved !== undefined) {
          inspection.effectiveValue = resolved as T;
          inspection.secretResolved = true;
        }
      }

      return inspection;
    },

    async set(
      key: string,
      value: unknown,
      layer?: ConfigurationLayer,
    ): Promise<void> {
      let provider: ConfigurationStorageProvider | undefined;

      if (layer !== undefined) {
        provider = findProviderForLayer(layer);
      } else {
        provider = findHighestWritableProvider();
      }

      if (provider === undefined || !provider.writable) {
        throw createWeaverError(
          "NOT_FOUND",
          layer !== undefined
            ? `No writable provider for layer "${layer}"`
            : "No writable provider available",
        );
      }

      await provider.write(key, value);

      const updated = {
        ...container.getLayerEntries(provider.layer),
        [key]: value,
      };
      container.applyLayerData(provider.layer, updated);
      options.scopeCache?.clear();
    },

    remove(key: string, layer: ConfigurationLayer): void {
      const provider = findProviderForLayer(layer);

      if (provider === undefined || !provider.writable) {
        throw createWeaverError(
          "NOT_FOUND",
          `No writable provider for layer "${layer}"`,
        );
      }

      provider.remove(key).catch((error: unknown) => {
        options.onWriteError?.(error, {
          key,
          layer: provider.layer,
          operation: "remove",
        });
      });

      const updated = container.getLayerEntries(provider.layer);
      delete updated[key];
      container.applyLayerData(provider.layer, updated);
      options.scopeCache?.clear();
    },

    onChange(key: string, listener: (value: unknown) => void): () => void {
      return container.onChange(key, listener);
    },

    getNamespace(prefix: string): Record<string, unknown> {
      return resolveMountedNamespace(
        prefix,
        mountMap,
        (p) => container.getNamespace(p),
        (k) => container.get(k),
      );
    },

    session: sessionHandle,
  };
}
