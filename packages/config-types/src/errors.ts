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

export class WeaverErrorInstance extends Error {
  readonly code: WeaverErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: WeaverErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WeaverError";
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export function createWeaverError(
  code: WeaverErrorCode,
  message: string,
  details?: Record<string, unknown>,
): WeaverErrorInstance {
  return new WeaverErrorInstance(code, message, details);
}
