// MongoDBStorageProvider — native MongoDB driver for user/device config layers

import {
  consoleLogger,
  extractErrorMessage,
  type WeaverLogger,
} from "@weaver/config-engine";
import type {
  ConfigurationChange,
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  WriteResult,
} from "@weaver/config-types";
import type { ChangeStream, Collection } from "mongodb";
import { z } from "zod";

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

export interface MongoDBStorageProviderOptions {
  id: string;
  layer: string;
  collection: Collection;
  environment: string;
  writable?: boolean | undefined;
  logger?: WeaverLogger;
  /** Timeout in milliseconds for MongoDB operations. Defaults to 30000 (30s). */
  timeoutMs?: number | undefined;
}

const configDocumentSchema = z.object({
  layer: z.string(),
  environment: z.string(),
  key: z.string(),
  value: z.unknown(),
  updatedAt: z.string(),
});

interface ConfigDocument {
  layer: string;
  environment: string;
  key: string;
  value: unknown;
  updatedAt: string;
}

/** @see {@link createMongoDBStorageProvider} — prefer the factory function for consistency */
class MongoDBStorageProvider implements ConfigurationStorageProvider {
  readonly id: string;
  readonly layer: string;
  readonly writable: boolean;

  private readonly collection: Collection;
  private readonly environment: string;
  private readonly logger: WeaverLogger;
  private readonly timeoutMs: number;

  constructor(options: MongoDBStorageProviderOptions) {
    this.id = options.id;
    this.layer = options.layer;
    this.writable = options.writable ?? true;
    this.collection = options.collection;
    this.environment = options.environment;
    this.logger = options.logger ?? consoleLogger;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async load(): Promise<ConfigurationLayerData> {
    let rawDocs: Awaited<ReturnType<ReturnType<Collection["find"]>["toArray"]>>;
    try {
      rawDocs = await this.collection
        .find({ layer: this.layer, environment: this.environment })
        .maxTimeMS(this.timeoutMs)
        .toArray();
    } catch (err) {
      const message = extractErrorMessage(err);
      this.logger.error(
        `[weaver] MongoDB load failed for provider "${this.id}": ${message}`,
      );
      throw new Error(
        `MongoDB load failed for provider "${this.id}": ${message}`,
      );
    }

    const docs = z.array(configDocumentSchema).parse(rawDocs);

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
    try {
      await this.collection.updateOne(
        { layer: this.layer, environment: this.environment, key },
        { $set: { value, updatedAt } },
        { upsert: true, maxTimeMS: this.timeoutMs },
      );
    } catch (err) {
      const message = extractErrorMessage(err);
      return {
        success: false,
        error: `MongoDB write failed for key "${key}": ${message}`,
      };
    }
    return { success: true };
  }

  async remove(key: string): Promise<WriteResult> {
    if (!this.writable) {
      return { success: false, error: "Provider is read-only" };
    }

    try {
      await this.collection.deleteOne(
        {
          layer: this.layer,
          environment: this.environment,
          key,
        },
        { maxTimeMS: this.timeoutMs },
      );
    } catch (err) {
      const message = extractErrorMessage(err);
      return {
        success: false,
        error: `MongoDB remove failed for key "${key}": ${message}`,
      };
    }
    return { success: true };
  }

  onExternalChange(
    listener: (changes: ConfigurationChange[]) => void,
  ): () => void {
    let backoffMs = BASE_BACKOFF_MS;
    let currentStream: ChangeStream | null = null;
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const setupChangeStream = (): void => {
      if (disposed) return;

      const stream = this.collection.watch([
        { $match: { "fullDocument.layer": this.layer } },
      ]);
      currentStream = stream;

      stream.on("change", (change: unknown) => {
        backoffMs = BASE_BACKOFF_MS;
        const doc = (change as { fullDocument?: ConfigDocument }).fullDocument;
        if (doc) {
          listener([
            { key: doc.key, oldValue: undefined, newValue: doc.value },
          ]);
        }
      });

      stream.on("error", (err: unknown) => {
        const message = extractErrorMessage(err);
        this.logger.error(
          `[weaver] MongoDB changeStream error for provider "${this.id}": ${message}`,
        );
        void stream.close();
        if (disposed) return;

        const delay = Math.min(backoffMs, MAX_BACKOFF_MS);
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
        reconnectTimer = setTimeout(setupChangeStream, delay);
      });
    };

    setupChangeStream();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      if (currentStream) {
        void currentStream.close();
      }
    };
  }
}

/** Creates a MongoDB-backed storage provider instance. */
export function createMongoDBStorageProvider(
  options: MongoDBStorageProviderOptions,
): ConfigurationStorageProvider {
  return new MongoDBStorageProvider(options);
}
