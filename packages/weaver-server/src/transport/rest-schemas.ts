import { z } from "zod";

/** PUT /v1/config/*keyPath body — value is required */
export const configWriteBodySchema = z.object({
  value: z.unknown(),
}).passthrough().refine(
  (data) => "value" in data,
  { message: "Missing required field 'value'", path: ["value"] },
);

/** PATCH /v1/config body — batch write with entries map */
export const configBatchBodySchema = z.object({
  entries: z.record(z.string(), z.unknown()),
});

/** POST /v1/admin/scopes/:scopeId body */
export const scopeProvisionBodySchema = z.object({
  value: z.string().min(1),
  displayName: z.string().optional(),
});

/** POST /v1/admin/promote body (for when route is implemented) */
export const promoteBodySchema = z.object({
  key: z.string(),
  layer: z.string(),
  sourceEnv: z.string(),
  targetEnv: z.string(),
});

/** POST /v1/admin/rollback body (for when route is implemented) */
export const rollbackBodySchema = z.object({
  layer: z.string(),
  environment: z.string(),
  toRevision: z.string(),
});

/** POST /v1/admin/schemas body (for when route is implemented) */
export const schemaRegisterBodySchema = z.object({
  serviceId: z.string(),
  schema: z.record(z.string(), z.unknown()),
  environment: z.string().optional(),
});
