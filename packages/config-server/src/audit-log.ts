// Audit log service interface for recording configuration mutations

import type { ConfigAuditEntry } from "@weaver/config-types";

export interface ConfigAuditLog {
  append(entry: ConfigAuditEntry): Promise<void>;
  queryByKey(key: string): Promise<ConfigAuditEntry[]>;
  queryByTimeRange(from: string, to: string): Promise<ConfigAuditEntry[]>;
  getRecent(limit?: number | undefined): Promise<ConfigAuditEntry[]>;
}
