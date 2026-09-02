import { z } from "zod";
import { weaverErrorSchema } from "./errors";
import { configurationPropertySchemaSchema } from "./schemas-property";

export const registrationOwnerSchema = z.strictObject({
  name: z.string().min(1),
  contact: z.string().min(1),
});

export const fragmentSlotDeclarationSchema = z.strictObject({
  slotPath: z.string().min(1),
  accepts: z.literal("object"),
});

export const serviceSchemaRegistrationRequestSchema = z.strictObject({
  serviceId: z.string().min(1),
  environment: z.string().min(1),
  owner: registrationOwnerSchema,
  schema: configurationPropertySchemaSchema,
  fragmentSlots: z.array(fragmentSlotDeclarationSchema).readonly(),
});

export const fragmentSchemaRegistrationRequestSchema = z.strictObject({
  serviceId: z.string().min(1),
  providerId: z.string().min(1),
  slotPath: z.string().min(1),
  environment: z.string().min(1),
  owner: registrationOwnerSchema,
  schema: configurationPropertySchemaSchema,
});

export const schemaRegistrationMetadataSchema = z.strictObject({
  serviceId: z.string(),
  servicePath: z.string(),
  environment: z.string(),
  canonicalSlotPath: z.string().optional(),
  providerId: z.string().optional(),
  fragmentPath: z.string().optional(),
});

export const schemaRegistrationResponseSchema = z.strictObject({
  success: z.boolean(),
  isNewSchema: z.boolean(),
  hasBreakingChanges: z.boolean(),
  metadata: schemaRegistrationMetadataSchema.optional(),
  breakingChanges: z.array(z.string()).readonly().optional(),
  error: weaverErrorSchema.optional(),
});
