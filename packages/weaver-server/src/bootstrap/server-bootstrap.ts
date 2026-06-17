// Server bootstrap adapter — resolves startup providers and owns optional resources

import type { ConfigurationStorageProvider } from "@weaver-conf/config-types";
import type { MongoClient } from "mongodb";
import { createInMemoryStorageProvider } from "../providers/index";
import { bootstrap } from "./bootstrap-loader";

export interface ServerBootstrapOptions {
  readonly providers?: ConfigurationStorageProvider[] | undefined;
  readonly repoUrl: string;
  readonly environment: string;
  readonly gitToken?: string | undefined;
  readonly mongoUri?: string | undefined;
}

export interface ServerBootstrapResult {
  readonly providers: ConfigurationStorageProvider[];
  dispose(): Promise<void>;
}

async function createMongoClient(uri: string): Promise<MongoClient> {
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri);
  await client.connect();
  return client;
}

export async function resolveServerBootstrap(
  options: ServerBootstrapOptions,
): Promise<ServerBootstrapResult> {
  if (options.providers) {
    return { providers: options.providers, dispose: async () => {} };
  }

  if (!options.repoUrl) {
    return {
      providers: [
        createInMemoryStorageProvider({ id: "default", layer: "platform" }),
      ],
      dispose: async () => {},
    };
  }

  let mongoClient: MongoClient | undefined;
  try {
    const { default: simpleGit } = await import("simple-git");
    mongoClient = options.mongoUri
      ? await createMongoClient(options.mongoUri)
      : undefined;
    const bootstrapped = await bootstrap({
      repoUrl: options.repoUrl,
      environment: options.environment,
      gitToken: options.gitToken,
      mongoUri: options.mongoUri,
      mongoCollection: mongoClient?.db().collection("weaver_config"),
      git: simpleGit(),
    });

    return {
      providers: bootstrapped.providers,
      dispose: async () => {
        await mongoClient?.close();
      },
    };
  } catch (err) {
    await mongoClient?.close();
    throw err;
  }
}
