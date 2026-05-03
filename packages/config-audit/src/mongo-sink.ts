// MongoDB audit sink — inserts audit entries into a collection
import { extractErrorMessage } from "@weaver/storage-provider-core";
import type { ConfigAuditSink, SinkDomainAuditEntry } from "./types.js";

export interface MongoCollection {
  insertOne(doc: Record<string, unknown>): Promise<unknown>;
}

export interface MongoAuditSinkOptions {
  collection: MongoCollection;
}

export function createMongoAuditSink(options: MongoAuditSinkOptions): ConfigAuditSink {
  const { collection } = options;

  return {
    async record(entry: SinkDomainAuditEntry): Promise<void> {
      try {
        await collection.insertOne(entry as unknown as Record<string, unknown>);
      } catch (err: unknown) {
        const message = extractErrorMessage(err);
        console.error(`[weaver] Audit record failed (non-blocking): ${message}`);
      }
    },
  };
}
