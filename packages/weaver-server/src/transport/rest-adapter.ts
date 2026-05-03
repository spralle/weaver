// REST transport adapter — maps HTTP routes to WeaverConfigService
import type { WeaverConfigService } from "../core/config-service.js";
import type { ScopeManager } from "../core/scope-manager.js";
import { createWeaverError, httpStatusForError } from "../types/index.js";
import type { WeaverErrorCode, WeaverError } from "../types/index.js";
import { parseScopeQuery } from "../core/scope-utils.js";

export interface RestRoute {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  handler: (req: RestRequest) => Promise<RestResponse>;
}

export interface RestRequest {
  params: Record<string, string>;
  query: Record<string, string>;
  body?: unknown;
  headers: Record<string, string>;
}

export interface RestResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface ApiResponse<T> {
  data: T;
  meta: { revision: string; timestamp: string };
}

export interface ApiErrorResponse {
  data: null;
  meta: { revision: string; timestamp: string };
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export interface RestAdapterOptions {
  configService: WeaverConfigService;
  scopeManager?: ScopeManager;
  corsOrigins?: string[];
}

export interface RestAdapter {
  readonly routes: ReadonlyArray<RestRoute>;
  handleRequest(
    method: string,
    path: string,
    req: RestRequest,
  ): Promise<RestResponse>;
}

interface RouteMatch {
  route: RestRoute;
  params: Record<string, string>;
}

function matchPath(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!;
    if (pp.startsWith(":")) {
      params[pp.slice(1)] = pathParts[i]!;
    } else if (pp !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function corsHeaders(origins: string[]): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origins.join(", "),
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function envelope<T>(data: T, revision: string): ApiResponse<T> {
  return { data, meta: { revision, timestamp: new Date().toISOString() } };
}

function errorEnvelope(error: WeaverError, revision: string): ApiErrorResponse {
  return {
    data: null,
    meta: { revision, timestamp: new Date().toISOString() },
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}

function v1Headers(revision: string, extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "ETag": `"${revision}"`,
    "Cache-Control": "no-cache",
    ...extra,
  };
}

function stub501(revision: string): RestResponse {
  return {
    status: 501,
    body: envelope({ error: "Not implemented" }, revision),
    headers: v1Headers(revision),
  };
}

export function createRestAdapter(options: RestAdapterOptions): RestAdapter {
  const { configService, scopeManager, corsOrigins } = options;

  function param(params: Record<string, string>, name: string): string {
    return params[name] as string;
  }

  function queryOpt(query: Record<string, string>, name: string): string | undefined {
    const v = query[name];
    return v === undefined ? undefined : v;
  }

  function v1Response<T>(status: number, data: T): RestResponse {
    const rev = configService.revision;
    return { status, body: envelope(data, rev), headers: v1Headers(rev) };
  }

  function v1Error(code: WeaverErrorCode, message: string): RestResponse {
    const rev = configService.revision;
    const err = createWeaverError(code, message);
    return {
      status: httpStatusForError(code),
      body: errorEnvelope(err, rev),
      headers: v1Headers(rev),
    };
  }

  function checkConcurrency(req: RestRequest): { ok: true } | { error: RestResponse } {
    const ifMatch = req.headers["if-match"];
    const ifNoneMatch = req.headers["if-none-match"];
    const rev = configService.revision;

    if (ifMatch !== undefined) {
      const expected = ifMatch.replace(/^"|"$/g, "");
      if (expected !== rev) {
        return {
          error: {
            status: 409,
            body: errorEnvelope(
              createWeaverError("REVISION_CONFLICT", `Expected revision ${expected}, current is ${rev}`),
              rev,
            ),
            headers: v1Headers(rev),
          },
        };
      }
    }

    if (ifNoneMatch === "*") {
      // "create-only" semantics — with global revision, pass through for v1
    }

    return { ok: true };
  }

  const routes: RestRoute[] = [
    // ── Config reads ──────────────────────────────────────
    {
      method: "GET",
      path: "/v1/config",
      async handler(req) {
        const scopePath = parseScopeQuery(queryOpt(req.query, "scope"));
        const opts = scopePath ? { scopePath } : {};
        const snapshot = await configService.resolveAll(opts);
        const prefix = queryOpt(req.query, "prefix");
        if (prefix) {
          const dotPrefix = `${prefix}.`;
          const filtered: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(snapshot.entries)) {
            if (k.startsWith(dotPrefix) || k === prefix) {
              filtered[k] = v;
            }
          }
          return v1Response(200, { ...snapshot, entries: filtered });
        }
        return v1Response(200, snapshot);
      },
    },
    {
      method: "GET",
      path: "/v1/config/:key",
      async handler(req) {
        const key = param(req.params, "key");
        const scopePath = parseScopeQuery(queryOpt(req.query, "scope"));
        const opts = scopePath ? { scopePath } : {};
        if ("inspect" in req.query) {
          const inspection = await configService.inspect(key);
          return v1Response(200, inspection);
        }
        const value = await configService.get(key, opts);
        return v1Response(200, { key, value });
      },
    },
    // ── Config writes ─────────────────────────────────────
    {
      method: "PUT",
      path: "/v1/config/:key",
      async handler(req) {
        const concurrency = checkConcurrency(req);
        if ("error" in concurrency) return concurrency.error;

        const key = param(req.params, "key");
        const layer = queryOpt(req.query, "layer") ?? "platform";
        const environment = queryOpt(req.query, "env");
        const body = req.body as Record<string, unknown> | undefined;
        const writeCtx = environment ? { environment } : {};
        const result = await configService.set(layer, key, body?.value, writeCtx);
        if (!result.success) {
          return v1Error("VALIDATION_ERROR", result.error ?? "Write failed");
        }
        return v1Response(200, result);
      },
    },
    {
      method: "DELETE",
      path: "/v1/config/:key",
      async handler(req) {
        const concurrency = checkConcurrency(req);
        if ("error" in concurrency) return concurrency.error;

        const key = param(req.params, "key");
        const layer = queryOpt(req.query, "layer") ?? "platform";
        const environment = queryOpt(req.query, "env");
        const writeCtx = environment ? { environment } : {};
        const result = await configService.remove(layer, key, writeCtx);
        if (!result.success) {
          return v1Error("VALIDATION_ERROR", result.error ?? "Remove failed");
        }
        return v1Response(200, result);
      },
    },
    // ── Scopes ────────────────────────────────────────────
    {
      method: "GET",
      path: "/v1/scopes",
      async handler() {
        if (!scopeManager) {
          return v1Response(200, { definitions: [] });
        }
        const definitions = scopeManager.listScopes();
        return v1Response(200, { definitions });
      },
    },
    {
      method: "GET",
      path: "/v1/scopes/:scopeId",
      async handler(req) {
        if (!scopeManager) {
          return v1Response(200, { values: [] });
        }
        const scopeId = param(req.params, "scopeId");
        const values = scopeManager.listScopeValues(scopeId);
        return v1Response(200, { values });
      },
    },
    // ── Admin ─────────────────────────────────────────────
    {
      method: "POST",
      path: "/v1/admin/promote",
      async handler() { return stub501(configService.revision); },
    },
    {
      method: "POST",
      path: "/v1/admin/rollback",
      async handler() { return stub501(configService.revision); },
    },
    {
      method: "POST",
      path: "/v1/admin/schemas",
      async handler() { return stub501(configService.revision); },
    },
    {
      method: "GET",
      path: "/v1/admin/schemas/:namespace",
      async handler() { return stub501(configService.revision); },
    },
    {
      method: "POST",
      path: "/v1/admin/scopes/:scopeId",
      async handler(req) {
        if (!scopeManager) {
          return stub501(configService.revision);
        }
        const scopeId = param(req.params, "scopeId");
        const body = req.body as Record<string, unknown> | undefined;
        const value = body?.value as string | undefined;
        if (!value) {
          return v1Error("VALIDATION_ERROR", "Missing 'value' in request body");
        }
        const displayName = body?.displayName as string | undefined;
        const result = await scopeManager.provision({
          scopeId,
          value,
          ...(displayName !== undefined ? { displayName } : {}),
          actor: "api",
        });
        if (!result.success) {
          return v1Error("VALIDATION_ERROR", result.error?.message ?? "Provision failed");
        }
        return v1Response(201, result);
      },
    },
    {
      method: "DELETE",
      path: "/v1/admin/scopes/:scopeId/:value",
      async handler(req) {
        if (!scopeManager) {
          return stub501(configService.revision);
        }
        const scopeId = param(req.params, "scopeId");
        const value = param(req.params, "value");
        const result = await scopeManager.deprovision({
          scopeId,
          value,
          actor: "api",
        });
        if (!result.success) {
          return v1Error("SCOPE_NOT_FOUND", result.error?.message ?? "Scope not found");
        }
        return v1Response(200, result);
      },
    },
    // ── Sessions ──────────────────────────────────────────
    { method: "POST", path: "/v1/admin/sessions", async handler() { return stub501(configService.revision); } },
    { method: "GET", path: "/v1/admin/sessions/active", async handler() { return stub501(configService.revision); } },
    { method: "DELETE", path: "/v1/admin/sessions/active", async handler() { return stub501(configService.revision); } },
    // ── Events (SSE) ──────────────────────────────────────
    { method: "GET", path: "/v1/events", async handler() { return stub501(configService.revision); } },
  ];

  function findRoute(method: string, path: string): RouteMatch | null {
    for (const route of routes) {
      if (route.method !== method) continue;
      const params = matchPath(route.path, path);
      if (params) return { route, params };
    }
    return null;
  }

  async function handleRequest(
    method: string,
    path: string,
    req: RestRequest,
  ): Promise<RestResponse> {
    const match = findRoute(method, path);
    if (!match) {
      const rev = configService.revision;
      return {
        status: 404,
        body: errorEnvelope(createWeaverError("NOT_FOUND", `No route: ${method} ${path}`), rev),
        headers: v1Headers(rev),
      };
    }

    const fullReq: RestRequest = { ...req, params: { ...req.params, ...match.params } };

    try {
      const response = await match.route.handler(fullReq);
      if (corsOrigins?.length) {
        response.headers = { ...response.headers, ...corsHeaders(corsOrigins) };
      }
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const rev = configService.revision;
      return {
        status: 500,
        body: errorEnvelope(createWeaverError("VALIDATION_ERROR", message), rev),
        headers: v1Headers(rev),
      };
    }
  }

  return { routes, handleRequest };
}
