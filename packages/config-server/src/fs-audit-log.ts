// File-system based audit log using JSON Lines (append-only) format

import { readFile, appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ConfigAuditEntry } from "@weaver/config-types";
import type { ConfigAuditLog } from "./audit-log.js";

function parseLines(content: string): ConfigAuditEntry[] {
  const entries: ConfigAuditEntry[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      entries.push(JSON.parse(trimmed) as ConfigAuditEntry);
    } catch {
      // Skip malformed lines
    }
  }
  return entries;
}

async function readAllEntries(filePath: string): Promise<ConfigAuditEntry[]> {
  try {
    const content = await readFile(filePath, "utf-8");
    return parseLines(content);
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

/**
 * Creates a file-system backed audit log using JSON Lines (append-only) format.
 *
 * **Scalability note**: Query operations (`queryByKey`, `queryByTimeRange`,
 * `getRecent`) read the entire log file into memory on every call. This
 * implementation is suitable for development, testing, and low-volume production
 * use (< ~10,000 entries). For high-volume production workloads, use a
 * database-backed audit log implementation instead.
 *
 * Writes are append-only and remain efficient regardless of file size.
 */
export function createFileSystemAuditLog(filePath: string): ConfigAuditLog {
  return {
    async append(entry: ConfigAuditEntry): Promise<void> {
      await mkdir(dirname(filePath), { recursive: true });
      await appendFile(filePath, JSON.stringify(entry) + "\n", "utf-8");
    },

    async queryByKey(key: string): Promise<ConfigAuditEntry[]> {
      const entries = await readAllEntries(filePath);
      return entries
        .filter((e) => e.key === key)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    },

    async queryByTimeRange(
      from: string,
      to: string,
    ): Promise<ConfigAuditEntry[]> {
      const entries = await readAllEntries(filePath);
      return entries
        .filter((e) => e.timestamp >= from && e.timestamp <= to)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    },

    async getRecent(limit?: number | undefined): Promise<ConfigAuditEntry[]> {
      const entries = await readAllEntries(filePath);
      const sorted = entries.sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp),
      );
      return limit !== undefined ? sorted.slice(0, limit) : sorted;
    },
  };
}
