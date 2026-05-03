import { z } from "zod";

export const configSnapshotSchema = z.object({
  platform: z.record(z.string(), z.unknown()),
  tenants: z.record(z.string(), z.record(z.string(), z.unknown())),
  revision: z.string(),
  timestamp: z.string(),
});
export type ConfigSnapshot = z.infer<typeof configSnapshotSchema>;
