import { z } from "zod";

export const configDeltaSchema = z.object({
  action: z.enum(["set", "remove"]),
  key: z.string(),
  value: z.unknown().nullable(),
  layer: z.string(),
  environment: z.string(),
  timestamp: z.string(),
});
export type ConfigDelta = z.infer<typeof configDeltaSchema>;

export const configSnapshotSchema = z.object({
  platform: z.record(z.string(), z.unknown()),
  tenants: z.record(z.string(), z.record(z.string(), z.unknown())),
  revision: z.string(),
  timestamp: z.string(),
});
export type ConfigSnapshot = z.infer<typeof configSnapshotSchema>;

export interface ResolveOptions {
  tenantId?: string;
  environment?: string;
}

export interface GetOptions {
  tenantId?: string;
}

export type Unsubscribe = () => void;
