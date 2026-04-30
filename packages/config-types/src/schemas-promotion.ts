// Zod schemas for promotion pipeline, audit, and emergency override types

import { z } from "zod";

export const promotionStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "applied",
  "expired",
]);

export const promotionRequestSchema = z.strictObject({
  id: z.string(),
  key: z.string(),
  fromValue: z.unknown(),
  toValue: z.unknown(),
  layer: z.string(),
  tenantId: z.string(),
  requestedBy: z.string(),
  requestedAt: z.string(),
  status: promotionStatusSchema,
  changePolicy: z.string(),
  reason: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
});

export const configAuditEntrySchema = z.strictObject({
  timestamp: z.string(),
  actor: z.string(),
  action: z.enum([
    "set",
    "remove",
    "install",
    "uninstall",
    "enable",
    "disable",
    "promote",
  ]),
  key: z.string(),
  layer: z.string(),
  tenantId: z.string().optional(),
  oldValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  changePolicy: z.string().optional(),
  isEmergencyOverride: z.boolean(),
  overrideReason: z.string().optional(),
});

export const emergencyOverrideRecordSchema = z.strictObject({
  id: z.string(),
  key: z.string(),
  actor: z.string(),
  reason: z.string(),
  tenantId: z.string(),
  layer: z.string(),
  createdAt: z.string(),
  followUpDeadline: z.string(),
  regularizedAt: z.string().optional(),
  regularizedBy: z.string().optional(),
});
