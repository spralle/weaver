import type {
  ConfigurationPropertySchema,
  FragmentSchemaRegistrationRequest,
  RegisteredEffectiveValidationResponse,
  SchemaRegistrationRequest,
  SchemaRegistrationResponse,
  ScopeInstance,
  ServiceSchemaRegistrationRequest,
} from "@weaver-conf/config-types";
import type { WriteOptions, WriteResult } from "./transport";

export interface HttpRegisteredContext {
  readonly baseUrl: string;
  readonly fetchFn: typeof globalThis.fetch;
  buildHeaders(): Record<string, string>;
  buildScopeQuery(scopePath?: ScopeInstance[]): string;
  queryString(params: Record<string, string | undefined>): string;
  request<T>(method: string, path: string, body?: unknown): Promise<T>;
}

export async function fetchRegisteredSchemas(
  context: HttpRegisteredContext,
): Promise<Record<string, ConfigurationPropertySchema>> {
  const result = await context.request<{
    schemas: Record<string, ConfigurationPropertySchema>;
  }>("GET", "/v1/admin/schemas");
  return result.schemas;
}

export async function postSchemaRegistration(
  context: HttpRegisteredContext,
  requestBody: SchemaRegistrationRequest,
): Promise<SchemaRegistrationResponse> {
  const path =
    "providerId" in requestBody
      ? "/v1/admin/schemas/fragments"
      : "/v1/admin/schemas/services";
  const res = await context.fetchFn(`${context.baseUrl}${path}`, {
    method: "POST",
    headers: context.buildHeaders(),
    body: JSON.stringify(requestBody),
  });
  const json = (await res.json()) as {
    data: SchemaRegistrationResponse | null;
    error?: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
  };
  if (!res.ok && json.error) return failedRegistration(json.error);
  if (json.data === null)
    throw new Error(`Missing schema response for ${path}`);
  return json.data;
}

export function postServiceSchemaRegistration(
  context: HttpRegisteredContext,
  requestBody: ServiceSchemaRegistrationRequest,
): Promise<SchemaRegistrationResponse> {
  return postSchemaRegistration(context, requestBody);
}

export function postFragmentSchemaRegistration(
  context: HttpRegisteredContext,
  requestBody: FragmentSchemaRegistrationRequest,
): Promise<SchemaRegistrationResponse> {
  return postSchemaRegistration(context, requestBody);
}

export function putRegisteredObject(
  context: HttpRegisteredContext,
  anchorPath: string,
  value: unknown,
  opts?: WriteOptions,
): Promise<WriteResult> {
  const path = canonicalPathUrl(anchorPath);
  const qs = context.queryString({
    layer: opts?.layer,
    env: opts?.environment,
  });
  return writeRequest(
    context,
    "PUT",
    `/v1/registered/objects${path}${qs}`,
    value,
    opts,
  );
}

export function patchRegisteredPath(
  context: HttpRegisteredContext,
  path: string,
  value: unknown,
  opts?: WriteOptions,
): Promise<WriteResult> {
  const canonicalPath = canonicalPathUrl(path);
  const qs = context.queryString({
    layer: opts?.layer,
    env: opts?.environment,
  });
  return writeRequest(
    context,
    "PATCH",
    `/v1/registered/paths${canonicalPath}${qs}`,
    value,
    opts,
  );
}

export function validateRegisteredEffective(
  context: HttpRegisteredContext,
  options: {
    anchorPath: string;
    environment?: string;
    scopePath?: ScopeInstance[];
  },
): Promise<RegisteredEffectiveValidationResponse> {
  const scope = context.buildScopeQuery(options.scopePath);
  const qs = context.queryString({
    environment: options.environment,
    scope: scope || undefined,
  });
  const path = canonicalPathUrl(options.anchorPath);
  return context.request<RegisteredEffectiveValidationResponse>(
    "GET",
    `/v1/registered/effective${path}${qs}`,
  );
}

async function writeRequest(
  context: HttpRegisteredContext,
  method: "PUT" | "PATCH",
  path: string,
  value: unknown,
  opts?: WriteOptions,
): Promise<WriteResult> {
  const headers = context.buildHeaders();
  if (opts?.ifRevision) headers["If-Match"] = `"${opts.ifRevision}"`;
  const res = await context.fetchFn(`${context.baseUrl}${path}`, {
    method,
    headers,
    body: JSON.stringify({ value }),
  });
  const json = (await res.json()) as {
    data: WriteResult | null;
    error?: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
  };
  if (!res.ok && json.error) return { success: false, error: json.error };
  if (json.data === null) throw new Error(`Missing write response for ${path}`);
  return json.data;
}

function failedRegistration(error: {
  message: string;
  details?: Record<string, unknown>;
}): SchemaRegistrationResponse {
  return {
    success: false,
    isNewSchema: false,
    hasBreakingChanges: false,
    error: {
      code: "VALIDATION_ERROR",
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}

function canonicalPathUrl(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}
