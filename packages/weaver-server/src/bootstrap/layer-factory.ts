// Layer factory — creates storage providers from validated bootstrap config
import type { Collection } from "mongodb";
import type { ConfigurationStorageProvider } from "@weaver/config-types";
import { InMemoryStorageProvider } from "@weaver/config-providers";
import type { BootstrapConfig } from "../types/bootstrap.js";
import type { GitWriteQueue } from "../git/write-queue.js";
import type { GitManager } from "../storage/git-manager.js";
import { GitStorageProvider } from "../storage/git-storage-provider.js";
import { MongoDBStorageProvider } from "../storage/mongodb-storage-provider.js";

export interface LayerFactoryDeps {
  gitManager: GitManager;
  writeQueue: GitWriteQueue;
  git: import("simple-git").SimpleGit;
  mongoCollection?: Collection | undefined;
  environment: string;
}

export function createProviders(
  config: BootstrapConfig,
  deps: LayerFactoryDeps,
): ConfigurationStorageProvider[] {
  return config.layers.map((layer) => {
    switch (layer.provider) {
      case "git":
        return new GitStorageProvider({
          id: layer.id,
          layer: layer.id,
          repoPath: deps.gitManager.localPath,
          filePath: layer.path ?? `${layer.id}.json`,
          writeQueue: deps.writeQueue,
          git: deps.git,
        });

      case "mongodb":
        if (!deps.mongoCollection) {
          throw new Error(
            `MongoDB collection required for layer "${layer.id}"`,
          );
        }
        return new MongoDBStorageProvider({
          id: layer.id,
          layer: layer.id,
          collection: deps.mongoCollection,
          environment: deps.environment,
        });

      case "memory":
        return new InMemoryStorageProvider({
          id: layer.id,
          layer: layer.id,
        });
    }
  });
}
