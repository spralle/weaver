// REST adapter helper utilities — extracted to keep rest-adapter.ts under 400 lines
import type { WeaverError } from "../types/index.js";

export interface ApiResponse<T> {
  data: T;
  meta: { revision: string; timestamp: string };
}

export interface ApiErrorResponse {
  data: null;
  meta: { revision: string; timestamp: string };
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export function matchPath(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");
  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!;
    if (pp.startsWith("*")) {
      const remaining = pathParts.slice(i);
      if (remaining.length === 0) return null;
      params[pp.slice(1)] = remaining.join("/");
      return params;
    }
    if (i >= pathParts.length) return null;
    if (pp.startsWith(":")) {
      params[pp.slice(1)] = pathParts[i]!;
    } else if (pp !== pathParts[i]) {
      return null;
    }
  }

  if (patternParts.length !== pathParts.length) return null;
  return params;
}

export function corsHeaders(origins: string[]): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origins.join(", "),
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function envelope<T>(data: T, revision: string): ApiResponse<T> {
  return { data, meta: { revision, timestamp: new Date().toISOString() } };
}

export function errorEnvelope(
  error: WeaverError,
  revision: string,
): ApiErrorResponse {
  const details = error.details ? { details: error.details } : {};
  return {
    data: null,
    meta: { revision, timestamp: new Date().toISOString() },
    error: { code: error.code, message: error.message, ...details },
  };
}

export function v1Headers(
  revision: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ETag: `"${revision}"`,
    "Cache-Control": "no-cache",
    ...extra,
  };
}
