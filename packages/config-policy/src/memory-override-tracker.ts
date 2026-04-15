// In-memory emergency override tracker for testing

import type { EmergencyOverrideRecord } from "@weaver/config-types";
import type { OverrideTracker, OverrideTrackerOptions } from "./override-tracker.js";
import { computeDeadline, resolveDeadlineMs } from "./override-tracker.js";

export function createInMemoryOverrideTracker(
  options?: OverrideTrackerOptions | undefined,
): OverrideTracker {
  const deadlineMs = resolveDeadlineMs(options);
  const records: EmergencyOverrideRecord[] = [];

  return {
    async create(
      record: Omit<EmergencyOverrideRecord, "followUpDeadline">,
    ): Promise<EmergencyOverrideRecord> {
      const full: EmergencyOverrideRecord = {
        ...record,
        followUpDeadline: computeDeadline(record.createdAt, deadlineMs),
      };
      records.push(full);
      return full;
    },

    async listActive(): Promise<EmergencyOverrideRecord[]> {
      return records.filter((r) => r.regularizedAt === undefined);
    },

    async regularize(
      id: string,
      regularizedBy: string,
    ): Promise<EmergencyOverrideRecord | undefined> {
      const index = records.findIndex((r) => r.id === id);
      if (index === -1) return undefined;

      const existing = records[index];
      if (existing === undefined) return undefined;

      const updated: EmergencyOverrideRecord = {
        ...existing,
        regularizedAt: new Date().toISOString(),
        regularizedBy,
      };
      records[index] = updated;
      return updated;
    },

    async listOverdue(
      now?: string | undefined,
    ): Promise<EmergencyOverrideRecord[]> {
      const nowTime = now !== undefined ? new Date(now).getTime() : Date.now();
      return records.filter(
        (r) =>
          r.regularizedAt === undefined &&
          new Date(r.followUpDeadline).getTime() < nowTime,
      );
    },
  };
}
