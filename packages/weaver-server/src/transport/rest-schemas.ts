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


