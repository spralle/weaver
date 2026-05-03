// schemas-session.ts — Zod schemas for session types

import { z } from "zod";

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
