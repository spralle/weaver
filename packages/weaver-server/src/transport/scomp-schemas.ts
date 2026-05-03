// Zod schemas for scomp WebSocket operation payloads
import { z } from "zod";

export const resolveAllPayloadSchema = z.object({
  scope: z.string().optional(),
});

export const getPayloadSchema = z.object({
  key: z.string(),
  scope: z.string().optional(),
});

export const getNamespacePayloadSchema = z.object({
  prefix: z.string(),
  scope: z.string().optional(),
});

export const inspectPayloadSchema = z.object({
  key: z.string(),
});

export const setPayloadSchema = z.object({
  layer: z.string(),
  key: z.string(),
  value: z.unknown(),
  scope: z.string().optional(),
  environment: z.string().optional(),
});

export const removePayloadSchema = z.object({
  layer: z.string(),
  key: z.string(),
  scope: z.string().optional(),
  environment: z.string().optional(),
});
