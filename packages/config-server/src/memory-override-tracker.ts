// In-memory emergency override tracker for testing

import type { EmergencyOverrideRecord } from "@weaver/config-types";
import type { OverrideTracker } from "./override-tracker.js";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function computeDeadline(createdAt: string): string {
  return new Date(
    new Date(createdAt).getTime() + TWENTY_FOUR_HOURS_MS,
  ).toISOString();
}

export function createInMemoryOverrideTracker(): OverrideTracker {
  const records: EmergencyOverrideRecord[] = [];

  return {
    async create(
      record: Omit<EmergencyOverrideRecord, "followUpDeadline">,
    ): Promise<EmergencyOverrideRecord> {
      const full: EmergencyOverrideRecord = {
        ...record,
        followUpDeadline: computeDeadline(record.createdAt),
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
