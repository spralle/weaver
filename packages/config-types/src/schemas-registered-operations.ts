import { z } from "zod";
import { writeResultSchema } from "./schemas-providers";
import { schemaValidationResultSchema } from "./schemas-schema-validation";

const registeredWriteOptionsSchema = {
  layer: z.string().min(1).optional(),
  environment: z.string().min(1).optional(),
  ifRevision: z.string().min(1).optional(),
};

export const registeredObjectWriteRequestSchema = z
  .strictObject({
    anchorPath: z.string().min(1),
    value: z.unknown(),
    ...registeredWriteOptionsSchema,
  })
  .refine((data) => "value" in data, {
    message: "Missing required field 'value'",
    path: ["value"],
  });

export const registeredPathPatchRequestSchema = z
  .strictObject({
    path: z.string().min(1),
    value: z.unknown(),
    ...registeredWriteOptionsSchema,
  })
  .refine((data) => "value" in data, {
    message: "Missing required field 'value'",
    path: ["value"],
  });

export const registeredEffectiveValidationRequestSchema = z.strictObject({
  anchorPath: z.string().min(1),
  environment: z.string().min(1).optional(),
  scope: z.string().min(1).optional(),
});

export const registeredObjectWriteResponseSchema = writeResultSchema;
export const registeredPathPatchResponseSchema = writeResultSchema;
export const registeredEffectiveValidationResponseSchema =
  schemaValidationResultSchema;
