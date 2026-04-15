// File-system based emergency override tracker using JSON array storage

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { EmergencyOverrideRecord } from "@weaver/config-types";
import type { OverrideTracker } from "./override-tracker.js";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function computeDeadline(createdAt: string): string {
  return new Date(
    new Date(createdAt).getTime() + TWENTY_FOUR_HOURS_MS,
  ).toISOString();
}

async function readRecords(
  filePath: string,
): Promise<EmergencyOverrideRecord[]> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as EmergencyOverrideRecord[];
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return [];
    }
    if (err instanceof SyntaxError) {
      return [];
    }
    throw err;
  }
}

async function writeRecords(
  filePath: string,
  records: EmergencyOverrideRecord[],
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(records, null, 2), "utf-8");
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

export function createFileSystemOverrideTracker(
  filePath: string,
): OverrideTracker {
  return {
    async create(
      record: Omit<EmergencyOverrideRecord, "followUpDeadline">,
    ): Promise<EmergencyOverrideRecord> {
      const records = await readRecords(filePath);
      const full: EmergencyOverrideRecord = {
        ...record,
        followUpDeadline: computeDeadline(record.createdAt),
      };
      records.push(full);
      await writeRecords(filePath, records);
      return full;
    },

    async listActive(): Promise<EmergencyOverrideRecord[]> {
      const records = await readRecords(filePath);
      return records.filter((r) => r.regularizedAt === undefined);
    },

    async regularize(
      id: string,
      regularizedBy: string,
    ): Promise<EmergencyOverrideRecord | undefined> {
      const records = await readRecords(filePath);
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
      await writeRecords(filePath, records);
      return updated;
    },

    async listOverdue(
      now?: string | undefined,
    ): Promise<EmergencyOverrideRecord[]> {
      const records = await readRecords(filePath);
      const nowTime = now !== undefined ? new Date(now).getTime() : Date.now();
      return records.filter(
        (r) =>
          r.regularizedAt === undefined &&
          new Date(r.followUpDeadline).getTime() < nowTime,
      );
    },
  };
}
