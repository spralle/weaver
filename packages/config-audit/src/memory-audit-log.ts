// In-memory audit log implementation for testing

import type { ConfigDomainAuditEntry } from "@weaver/config-types";
import type { ConfigAuditLog } from "./types.js";

export function createInMemoryAuditLog(): ConfigAuditLog {
  const entries: ConfigDomainAuditEntry[] = [];

  return {
    async append(entry: ConfigDomainAuditEntry): Promise<void> {
      entries.push(entry);
    },

    async queryByKey(key: string): Promise<ConfigDomainAuditEntry[]> {
      return entries
        .filter((e) => e.key === key)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    },

    async queryByTimeRange(
      from: string,
      to: string,
    ): Promise<ConfigDomainAuditEntry[]> {
      return entries
        .filter((e) => e.timestamp >= from && e.timestamp <= to)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    },

    async getRecent(
      limit?: number | undefined,
    ): Promise<ConfigDomainAuditEntry[]> {
      const sorted = [...entries].sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp),
      );
      return limit !== undefined ? sorted.slice(0, limit) : sorted;
    },
  };
}
