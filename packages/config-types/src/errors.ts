import { z } from "zod";

export const weaverErrorCodes = [
  "NOT_FOUND",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "SCOPE_NOT_FOUND",
  "SCOPE_NOT_LOADED",
  "SCHEMA_CONFLICT",
  "POLICY_VIOLATION",
  "VALIDATION_ERROR",
  "GIT_ERROR",
  "SERVER_DEGRADED",
  "SIZE_WARNING",
  "QUEUE_FULL",
  "SESSION_REQUIRED",
  "SESSION_BLOCKED",
  "REVISION_CONFLICT",
  "INTERNAL_ERROR",
] as const;

export const weaverErrorCodeSchema = z.enum(weaverErrorCodes);
export type WeaverErrorCode = z.infer<typeof weaverErrorCodeSchema>;

export const weaverErrorSchema = z.object({
  code: weaverErrorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type WeaverError = z.infer<typeof weaverErrorSchema>;

export function createWeaverError(
  code: WeaverErrorCode,
  message: string,
  details?: Record<string, unknown>,
): WeaverError {
  return details !== undefined ? { code, message, details } : { code, message };
}
