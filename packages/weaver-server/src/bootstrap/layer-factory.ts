// Layer factory — creates storage providers from validated bootstrap config
import type { Collection } from "mongodb";
import type { ConfigurationStorageProvider } from "@weaver/config-types";
import { createInMemoryStorageProvider } from "@weaver/config-providers";
import type { BootstrapLayer } from "../types/bootstrap.js";
import type { GitManager } from "../storage/git-manager.js";
import { createGitStorageProvider } from "../storage/git-storage-provider.js";
import { createMongoDBStorageProvider } from "../storage/mongodb-storage-provider.js";

export interface LayerFactoryDeps {
  gitManager: GitManager;
  mongoCollection?: Collection | undefined;
  environment: string;
}

export type ProviderFactory = (
  layer: BootstrapLayer,
  deps: LayerFactoryDeps,
) => ConfigurationStorageProvider;

const providerRegistry = new Map<string, ProviderFactory>();

export function registerProviderFactory(
  type: string,
  factory: ProviderFactory,
): void {
  providerRegistry.set(type, factory);
}

function createGitProvider(layer: BootstrapLayer, deps: LayerFactoryDeps): ConfigurationStorageProvider {
  return createGitStorageProvider({
    id: layer.id,
    layer: layer.id,
    gitManager: deps.gitManager,
    filePath: layer.path ?? `${layer.id}.json`,
  });
}

function createMongoProvider(layer: BootstrapLayer, deps: LayerFactoryDeps): ConfigurationStorageProvider {
  if (!deps.mongoCollection) {
    throw new Error(`MongoDB collection required for layer "${layer.id}"`);
  }
  return createMongoDBStorageProvider({
    id: layer.id,
    layer: layer.id,
    collection: deps.mongoCollection,
    environment: deps.environment,
  });
}

function createMemoryProvider(layer: BootstrapLayer): ConfigurationStorageProvider {
  return createInMemoryStorageProvider({
    id: layer.id,
    layer: layer.id,
  });
}

// Register built-in providers
registerProviderFactory("git", createGitProvider);
registerProviderFactory("mongodb", createMongoProvider);
registerProviderFactory("memory", (layer, _deps) => createMemoryProvider(layer));

export function createProviders(
  config: { layers: BootstrapLayer[] },
  deps: LayerFactoryDeps,
): ConfigurationStorageProvider[] {
  return config.layers.map((layer) => {
    const factory = providerRegistry.get(layer.provider);
    if (!factory) {
      throw new Error(`Unknown provider type "${layer.provider}" for layer "${layer.id}"`);
    }
    return factory(layer, deps);
  });
}
