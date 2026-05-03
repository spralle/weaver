import { z } from "zod";

export const configSnapshotSchema = z.object({
  entries: z.record(z.string(), z.unknown()),
  scopes: z.record(z.string(), z.record(z.string(), z.unknown())),
  revision: z.string(),
  timestamp: z.string().optional(),
});
export type ConfigSnapshot = z.infer<typeof configSnapshotSchema>;
