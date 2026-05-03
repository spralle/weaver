// Audit service with pluggable sinks and sensitive value masking
import type { WeaverLogger } from "@weaver/storage-provider-core";
import { consoleLogger } from "@weaver/storage-provider-core";
import type { ConfigAuditSink, AuditEntry } from "./types.js";

export interface AuditServiceOptions {
  sinks: ConfigAuditSink[];
  sensitiveKeys?: Set<string>;
  logger?: WeaverLogger;
}

export interface AuditService {
  record(entry: AuditEntry): Promise<void>;
}

export function createAuditService(options: AuditServiceOptions): AuditService {
  const { sinks, sensitiveKeys } = options;
  const logger = options.logger ?? consoleLogger;

  function maskEntry(entry: AuditEntry): AuditEntry {
    if (!sensitiveKeys || !sensitiveKeys.has(entry.key)) {
      return entry;
    }
    return {
      ...entry,
      oldValue: entry.oldValue !== undefined ? "***" : undefined,
      newValue: entry.newValue !== undefined ? "***" : undefined,
    };
  }

  return {
    async record(entry: AuditEntry): Promise<void> {
      const masked = maskEntry(entry);
      const results = await Promise.allSettled(
        sinks.map((sink) => sink.record(masked)),
      );
      for (const result of results) {
        if (result.status === "rejected") {
          logger.error("[audit] sink failed:", result.reason);
        }
      }
    },
  };
}
