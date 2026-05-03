// Unified audit interfaces for Weaver configuration changes

import type { ConfigAuditEntry } from "@weaver/config-types";

/**
 * Queryable audit log — supports append and various query patterns.
 * Used by config-server for full audit history access.
 */
export interface ConfigAuditLog {
  append(entry: ConfigAuditEntry): Promise<void>;
  queryByKey(key: string): Promise<ConfigAuditEntry[]>;
  queryByTimeRange(from: string, to: string): Promise<ConfigAuditEntry[]>;
  getRecent(limit?: number | undefined): Promise<ConfigAuditEntry[]>;
}

/**
 * Structured audit entry for the dispatcher/sink pipeline.
 * Superset of fields from both config-server and weaver-server audit systems.
 */
export interface AuditEntry {
  timestamp: string;
  actor: string;
  action: "set" | "remove" | "promote" | "rollback" | "override" | "provision";
  key: string;
  layer: string;
  environment: string;
  scopePath?: string;
  oldValue?: unknown;
  newValue?: unknown;
  isEmergencyOverride: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Write-only audit sink — receives masked entries from the audit service dispatcher.
 */
export interface ConfigAuditSink {
  record(entry: AuditEntry): Promise<void>;
}
