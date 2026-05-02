// MongoDB audit sink — inserts audit entries into a collection
import type { ConfigAuditSink, AuditEntry } from "./audit-service.js";

export interface MongoCollection {
  insertOne(doc: Record<string, unknown>): Promise<unknown>;
}

export interface MongoAuditSinkOptions {
  collection: MongoCollection;
}

export function createMongoAuditSink(options: MongoAuditSinkOptions): ConfigAuditSink {
  const { collection } = options;

  return {
    async record(entry: AuditEntry): Promise<void> {
      await collection.insertOne(entry as unknown as Record<string, unknown>);
    },
  };
}
