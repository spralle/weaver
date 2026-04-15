import { z } from "zod";

// --- Write result and change schemas ---

export const writeResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  revision: z.string().optional(),
}).strict();

export const configurationChangeSchema = z.object({
  key: z.string(),
  oldValue: z.unknown(),
  newValue: z.unknown(),
}).strict();

// --- Conflict and sync schemas ---

export const configurationConflictSchema = z.object({
  key: z.string(),
  localValue: z.unknown(),
  remoteValue: z.unknown(),
  localRevision: z.string(),
  remoteRevision: z.string(),
}).strict();

export const syncResultSchema = z.object({
  pulled: z.number(),
  pushed: z.number(),
  conflicts: z.array(configurationConflictSchema),
}).strict();

export const syncQueueMetadataSchema = z.object({
  pendingCount: z.number(),
  inFlightCount: z.number(),
  oldestQueuedAt: z.number().optional(),
  newestQueuedAt: z.number().optional(),
}).strict();

export const syncStatusSyncedSchema = z.object({
  status: z.literal("synced"),
  lastSyncedAt: z.number(),
}).strict();

export const syncStatusSyncingSchema = z.object({
  status: z.literal("syncing"),
}).strict();

export const syncStatusOfflineSchema = z.object({
  status: z.literal("offline"),
  lastSyncedAt: z.number(),
  pendingWriteCount: z.number(),
}).strict();

export const syncStatusConflictSchema = z.object({
  status: z.literal("conflict"),
  conflicts: z.array(configurationConflictSchema),
}).strict();

export const syncStatusErrorSchema = z.object({
  status: z.literal("error"),
  error: z.string(),
  lastSyncedAt: z.number().optional(),
}).strict();

export const syncStatusSchema = z.discriminatedUnion("status", [
  syncStatusSyncedSchema,
  syncStatusSyncingSchema,
  syncStatusOfflineSchema,
  syncStatusConflictSchema,
  syncStatusErrorSchema,
]);

// --- Inspection schema ---

export const configurationInspectionSchema = z.object({
  key: z.string(),
  effectiveValue: z.unknown().optional(),
  effectiveLayer: z.string().optional(),
  layerValues: z.record(z.string(), z.unknown()).optional(),
}).strict();
