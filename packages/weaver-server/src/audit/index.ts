// Types

export type { AuditService, AuditServiceOptions } from "./audit-service";
export { createAuditService } from "./audit-service";
// Implementations
export { createFileSystemAuditLog } from "./fs-audit-log";
export { createInMemoryAuditLog } from "./memory-audit-log";
export type { MongoAuditSinkOptions, MongoCollection } from "./mongo-sink";
export { createMongoAuditSink } from "./mongo-sink";
export { createStdoutAuditSink } from "./stdout-sink";
export type {
  ConfigAuditEntry,
  ConfigAuditLog,
  ConfigAuditSink,
  ConfigDomainAuditEntry,
  SinkDomainAuditEntry,
} from "./types";
