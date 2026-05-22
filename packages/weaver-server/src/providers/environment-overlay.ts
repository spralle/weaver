// Environment overlay: wraps a provider with base + env deep-merge

import { deepMerge } from "@weaver-conf/config-engine";
import type {
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  ConfigValueSource,
  EnvironmentAwareStorageProvider,
  EnvironmentName,
  MergedLayerResult,
} from "@weaver-conf/config-types";

export interface EnvironmentOverlayOptions {
  /** The base provider to wrap */
  readonly provider: ConfigurationStorageProvider &
    EnvironmentAwareStorageProvider;
  /** The target environment to apply as overlay */
  readonly environment: EnvironmentName;
}

/**
 * Wraps an EnvironmentAwareStorageProvider to pre-merge base + env overlay.
 * When load() is called, it loads both "base" and the target environment,
 * deep-merges them (env overlay wins), and returns the merged result.
 * Also tracks per-key provenance (base vs overlay).
 */
export function withEnvironmentOverlay(
  options: EnvironmentOverlayOptions,
): ConfigurationStorageProvider & {
  readonly sources: ReadonlyMap<string, ConfigValueSource>;
} {
  const { provider, environment } = options;
  let sources = new Map<string, ConfigValueSource>();

  return {
    id: provider.id,
    layer: provider.layer,
    writable: provider.writable,

    async load(): Promise<ConfigurationLayerData> {
      const merged = await mergeWithEnvironment(provider, environment);
      sources = new Map(merged.sources);
      return { entries: merged.entries };
    },

    write: provider.write.bind(provider),
    remove: provider.remove.bind(provider),

    ...(provider.onExternalChange
      ? { onExternalChange: provider.onExternalChange.bind(provider) }
      : {}),

    get sources(): ReadonlyMap<string, ConfigValueSource> {
      return sources;
    },
  };
}

/**
 * Loads base + environment overlay and deep-merges them.
 * Returns merged entries and per-key source provenance.
 */
export async function mergeWithEnvironment(
  provider: EnvironmentAwareStorageProvider & { layer?: string },
  environment: EnvironmentName,
): Promise<MergedLayerResult> {
  const [baseResult, envResult] = await Promise.all([
    provider.loadForEnvironment("base"),
    environment !== "base"
      ? provider.loadForEnvironment(environment)
      : Promise.resolve({ entries: {} }),
  ]);

  const baseEntries = baseResult.entries;
  const envEntries = envResult.entries;

  // Deep merge: env overlay wins
  const merged = deepMerge(baseEntries, envEntries);

  // Build source map
  const sources = new Map<string, ConfigValueSource>();
  const layer = typeof provider.layer === "string" ? provider.layer : "unknown";

  for (const key of Object.keys(baseEntries)) {
    sources.set(key, {
      layer,
      environment: "base",
      isOverlay: false,
    });
  }

  // Keys from env overlay override source to "overlay"
  for (const key of Object.keys(envEntries)) {
    sources.set(key, {
      layer,
      environment,
      isOverlay: true,
    });
  }

  return { entries: merged, sources };
}
