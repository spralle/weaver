// MongoDBStorageProvider — native MongoDB driver for user/device config layers
import type { Collection } from "mongodb";
import type {
  ConfigurationChange,
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  WriteResult,
} from "@weaver/config-types";
import { consoleLogger } from "../logger.js";

export interface MongoDBStorageProviderOptions {
  id: string;
  layer: string;
  collection: Collection;
  environment: string;
  writable?: boolean | undefined;
}

interface ConfigDocument {
  layer: string;
  environment: string;
  key: string;
  value: unknown;
  updatedAt: string;
}

/** @see {@link createMongoDBStorageProvider} — prefer the factory function for consistency */
export class MongoDBStorageProvider implements ConfigurationStorageProvider {
  readonly id: string;
  readonly layer: string;
  readonly writable: boolean;

  private readonly collection: Collection;
  private readonly environment: string;

  constructor(options: MongoDBStorageProviderOptions) {
    this.id = options.id;
    this.layer = options.layer;
    this.writable = options.writable ?? true;
    this.collection = options.collection;
    this.environment = options.environment;
  }

  async load(): Promise<ConfigurationLayerData> {
    const docs = await this.collection
      .find({ layer: this.layer, environment: this.environment })
      .toArray() as unknown as ConfigDocument[];

    const entries: Record<string, unknown> = {};
    for (const doc of docs) {
      entries[doc.key] = doc.value;
    }
    return { entries };
  }

  async write(key: string, value: unknown): Promise<WriteResult> {
    if (!this.writable) {
      return { success: false, error: "Provider is read-only" };
    }

    const updatedAt = new Date().toISOString();
    await this.collection.updateOne(
      { layer: this.layer, environment: this.environment, key },
      { $set: { value, updatedAt } },
      { upsert: true },
    );
    return { success: true };
  }

  async remove(key: string): Promise<WriteResult> {
    if (!this.writable) {
      return { success: false, error: "Provider is read-only" };
    }

    await this.collection.deleteOne({
      layer: this.layer,
      environment: this.environment,
      key,
    });
    return { success: true };
  }

  onExternalChange(
    listener: (changes: ConfigurationChange[]) => void,
  ): () => void {
    const changeStream = this.collection.watch([
      { $match: { "fullDocument.layer": this.layer } },
    ]);

    changeStream.on("change", (change: unknown) => {
      const doc = (change as { fullDocument?: ConfigDocument }).fullDocument;
      if (doc) {
        listener([{ key: doc.key, oldValue: undefined, newValue: doc.value }]);
      }
    });

    changeStream.on("error", (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      consoleLogger.error(
        `[weaver] MongoDB changeStream error for provider "${this.id}": ${message}`,
      );
      void changeStream.close();
    });

    return () => {
      void changeStream.close();
    };
  }
}

/** Creates a MongoDB-backed storage provider instance. */
export function createMongoDBStorageProvider(
  options: MongoDBStorageProviderOptions,
): MongoDBStorageProvider {
  return new MongoDBStorageProvider(options);
}
