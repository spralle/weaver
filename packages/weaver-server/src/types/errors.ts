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

export const HTTP_STATUS_MAP: Record<WeaverErrorCode, number> = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  SCOPE_NOT_FOUND: 404,
  SCOPE_NOT_LOADED: 409,
  SCHEMA_CONFLICT: 409,
  POLICY_VIOLATION: 400,
  VALIDATION_ERROR: 400,
  GIT_ERROR: 503,
  SERVER_DEGRADED: 503,
  SIZE_WARNING: 200,
  QUEUE_FULL: 429,
  SESSION_REQUIRED: 428,
  SESSION_BLOCKED: 403,
  REVISION_CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export function httpStatusForError(code: WeaverErrorCode): number {
  return HTTP_STATUS_MAP[code];
}
