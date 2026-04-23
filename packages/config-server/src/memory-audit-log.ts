// In-memory audit log implementation for testing

import type { ConfigAuditEntry } from "@weaver/config-types";
import type { ConfigAuditLog } from "./audit-log.js";

export function createInMemoryAuditLog(): ConfigAuditLog {
  const entries: ConfigAuditEntry[] = [];

  return {
    async append(entry: ConfigAuditEntry): Promise<void> {
      entries.push(entry);
    },

    async queryByKey(key: string): Promise<ConfigAuditEntry[]> {
      return entries
        .filter((e) => e.key === key)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    },

    async queryByTimeRange(
      from: string,
      to: string,
    ): Promise<ConfigAuditEntry[]> {
      return entries
        .filter((e) => e.timestamp >= from && e.timestamp <= to)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    },

    async getRecent(limit?: number | undefined): Promise<ConfigAuditEntry[]> {
      const sorted = [...entries].sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp),
      );
      return limit !== undefined ? sorted.slice(0, limit) : sorted;
    },
  };
}
