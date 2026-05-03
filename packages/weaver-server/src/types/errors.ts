// Re-export shared error taxonomy from @weaver/config-types
export {
  weaverErrorCodes,
  weaverErrorCodeSchema,
  weaverErrorSchema,
  createWeaverError,
} from "@weaver/config-types";
export type { WeaverErrorCode, WeaverError } from "@weaver/config-types";

// Server-specific HTTP status mapping (not shared to config-types)
import type { WeaverErrorCode } from "@weaver/config-types";

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
