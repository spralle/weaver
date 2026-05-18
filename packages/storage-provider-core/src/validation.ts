import { z } from "zod";

const configEntriesSchema = z.record(z.string(), z.unknown());

/**
 * Validate and parse raw data as a config entries record at I/O boundaries.
 */
export function safeParseConfigEntries(raw: unknown): Record<string, unknown> {
  return configEntriesSchema.parse(raw);
}
