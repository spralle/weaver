// MongoDBStorageProvider — native MongoDB driver for user/device config layers
import type { Collection, ChangeStream } from "mongodb";
import type {
  ConfigurationChange,
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  WriteResult,
} from "@weaver/config-types";
import type { WeaverLogger } from "../logger.js";
import { consoleLogger } from "../logger.js";

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

export interface MongoDBStorageProviderOptions {
  id: string;
  layer: string;
  collection: Collection;
  environment: string;
  writable?: boolean | undefined;
  logger?: WeaverLogger;
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
  private readonly logger: WeaverLogger;
  private disposed = false;

  constructor(options: MongoDBStorageProviderOptions) {
    this.id = options.id;
    this.layer = options.layer;
    this.writable = options.writable ?? true;
    this.collection = options.collection;
    this.environment = options.environment;
    this.logger = options.logger ?? consoleLogger;
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
    let backoffMs = BASE_BACKOFF_MS;
    let currentStream: ChangeStream | null = null;

    const setupChangeStream = (): void => {
      if (this.disposed) return;

      const stream = this.collection.watch([
        { $match: { "fullDocument.layer": this.layer } },
      ]);
      currentStream = stream;

      stream.on("change", (change: unknown) => {
        backoffMs = BASE_BACKOFF_MS;
        const doc = (change as { fullDocument?: ConfigDocument }).fullDocument;
        if (doc) {
          listener([{ key: doc.key, oldValue: undefined, newValue: doc.value }]);
        }
      });

      stream.on("error", (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `[weaver] MongoDB changeStream error for provider "${this.id}": ${message}`,
        );
        void stream.close();
        if (this.disposed) return;

        const delay = Math.min(backoffMs, MAX_BACKOFF_MS);
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
        setTimeout(setupChangeStream, delay);
      });
    };

    setupChangeStream();

    return () => {
      this.disposed = true;
      if (currentStream) {
        void currentStream.close();
      }
    };
  }
}

/** Creates a MongoDB-backed storage provider instance. */
export function createMongoDBStorageProvider(
  options: MongoDBStorageProviderOptions,
): MongoDBStorageProvider {
  return new MongoDBStorageProvider(options);
}
