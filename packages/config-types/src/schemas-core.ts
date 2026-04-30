import { z } from "zod";

import type { ConfigurationPropertySchema } from "./property-schema.js";

// --- Layer and context schemas ---

export const configurationLayerSchema = z.string();

export const scopeDefinitionSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  parentScopeId: z.string().optional(),
});

export const scopeInstanceSchema = z.strictObject({
  scopeId: z.string(),
  value: z.string(),
});

export const tenantScopeHierarchySchema = z.strictObject({
  scopes: z.array(scopeDefinitionSchema),
});

export const configurationContextSchema = z.strictObject({
  tenantId: z.string(),
  scopePath: z.array(scopeInstanceSchema),
  userId: z.string(),
  deviceId: z.string(),
});

export const configurationLayerEntrySchema = z.strictObject({
  layer: z.string(),
  entries: z.record(z.string(), z.unknown()),
});

export const configurationLayerStackSchema = z.strictObject({
  layers: z.array(configurationLayerEntrySchema),
});

export const configurationLayerDataSchema = z.strictObject({
  entries: z.record(z.string(), z.unknown()),
  revision: z.string().optional(),
  lastSyncedAt: z.number().optional(),
});

// --- Change policy and role schemas ---

export const configChangePolicySchema = z.enum([
  "full-pipeline",
  "staging-gate",
  "direct-allowed",
  "emergency-override",
]);

export const configurationVisibilitySchema = z.enum([
  "public",
  "admin",
  "platform",
  "internal",
]);

export const configurationRoleSchema = z.string();

export const configReloadBehaviorSchema = z.enum([
  "hot",
  "restart-required",
  "rolling-restart",
]);

export const configurationJsonSchemaTypeSchema = z.enum([
  "string",
  "number",
  "integer",
  "boolean",
  "object",
  "array",
  "null",
]);

export const propertySessionModeSchema = z.enum([
  "allowed",
  "restricted",
  "blocked",
]);

export const configurationPropertySchemaSchema: z.ZodType<ConfigurationPropertySchema> =
  z.lazy(() =>
    z.strictObject({
      type: z.union([
        configurationJsonSchemaTypeSchema,
        z.array(configurationJsonSchemaTypeSchema).readonly(),
      ]),
      title: z.string().optional(),
      default: z.unknown().optional(),
      description: z.string().optional(),
      examples: z.array(z.unknown()).readonly().optional(),
      const: z.unknown().optional(),
      enum: z.array(z.unknown()).readonly().optional(),
      format: z.string().optional(),
      pattern: z.string().optional(),
      minLength: z.number().int().nonnegative().optional(),
      maxLength: z.number().int().nonnegative().optional(),
      multipleOf: z.number().positive().optional(),
      minimum: z.number().optional(),
      maximum: z.number().optional(),
      exclusiveMinimum: z.number().optional(),
      exclusiveMaximum: z.number().optional(),
      minItems: z.number().int().nonnegative().optional(),
      maxItems: z.number().int().nonnegative().optional(),
      uniqueItems: z.boolean().optional(),
      minProperties: z.number().int().nonnegative().optional(),
      maxProperties: z.number().int().nonnegative().optional(),
      required: z.array(z.string()).readonly().optional(),
      properties: z
        .record(z.string(), configurationPropertySchemaSchema)
        .optional(),
      patternProperties: z
        .record(z.string(), configurationPropertySchemaSchema)
        .optional(),
      additionalProperties: z
        .union([z.boolean(), configurationPropertySchemaSchema])
        .optional(),
      items: z
        .union([
          configurationPropertySchemaSchema,
          z.array(configurationPropertySchemaSchema).readonly(),
        ])
        .optional(),
      oneOf: z.array(configurationPropertySchemaSchema).readonly().optional(),
      anyOf: z.array(configurationPropertySchemaSchema).readonly().optional(),
      allOf: z.array(configurationPropertySchemaSchema).readonly().optional(),
      not: configurationPropertySchemaSchema.optional(),

      // Unsupported by policy (self-contained schemas only)
      $ref: z.never().optional(),
      $defs: z.never().optional(),

      expressionAllowed: z.boolean().optional(),
      changePolicy: configChangePolicySchema.optional(),
      visibility: configurationVisibilitySchema.optional(),
      sensitive: z.boolean().optional(),
      maxOverrideLayer: configurationLayerSchema.optional(),
      writeRestriction: z.array(configurationRoleSchema).readonly().optional(),
      viewConfig: z.boolean().optional(),
      instanceOverridable: z.boolean().optional(),
      reloadBehavior: configReloadBehaviorSchema.optional(),
      sessionMode: propertySessionModeSchema.optional(),
    }),
  );

// --- Expression schemas ---

export const expressionValidationResultSchema = z.strictObject({
  valid: z.boolean(),
  errors: z.array(z.string()).readonly().optional(),
});

// --- Session schemas ---

export const sessionTypeSchema = z.string();

/** @deprecated Use `sessionTypeSchema` instead. */
export const sessionModeSchema = sessionTypeSchema;

export const sessionLayerMetadataSchema = z.strictObject({
  activatedBy: z.string(),
  activatedAt: z.number(),
  reason: z.string(),
  mode: sessionTypeSchema,
  expiresAt: z.number().optional(),
});

export const overrideSessionSchema = z.strictObject({
  id: z.string(),
  activatedAt: z.string(),
  expiresAt: z.string(),
  activatedBy: z.string(),
  reason: z.string(),
  isActive: z.boolean(),
  overrides: z.record(z.string(), z.unknown()),
});

/** @deprecated Use `overrideSessionSchema` instead. */
export const godModeSessionSchema = overrideSessionSchema;

export const sessionActivationRequestSchema = z.strictObject({
  reason: z.string(),
  durationMs: z.number().optional(),
  elevatedAuth: z
    .strictObject({
      token: z.string(),
      method: z.string(),
    })
    .optional(),
  activatedBy: z.string().optional(),
});

export const sessionDeactivationResultSchema = z.strictObject({
  sessionId: z.string(),
  deactivatedAt: z.string(),
  overridesCleared: z.number(),
  auditRecorded: z.boolean(),
});

// --- Access context schemas ---

export const configurationAccessContextSchema = z.strictObject({
  userId: z.string(),
  tenantId: z.string(),
  roles: z.array(configurationRoleSchema).readonly(),
  assignedScopes: z.array(scopeInstanceSchema).readonly().optional(),
  sessionMode: z
    .union([z.literal("emergency-override"), sessionTypeSchema])
    .optional(),
});

export const layerWriteConstraintSchema = z.strictObject({
  scopeRestriction: z.enum(["own-tenant", "own-scope", "own-user"]).optional(),
});

export const layerWritePolicySchema = z.strictObject({
  layer: z.string(),
  allowedRoles: z.array(configurationRoleSchema).readonly(),
  constraints: z.array(layerWriteConstraintSchema).readonly().optional(),
});

export const serviceConfigurationDeclarationSchema = z.strictObject({
  serviceId: z.string(),
  description: z.string(),
  configuration: z.strictObject({
    properties: z.record(z.string(), configurationPropertySchemaSchema),
  }),
  reads: z.array(z.string()).readonly().optional(),
});
