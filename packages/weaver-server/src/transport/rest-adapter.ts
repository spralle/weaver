// REST transport adapter — maps HTTP routes to WeaverConfigService
import type { WeaverConfigService } from "../core/config-service.js";
import { createWeaverError, httpStatusForError } from "../types/index.js";
import type { WeaverErrorCode } from "../types/index.js";

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

export interface RestAdapterOptions {
  configService: WeaverConfigService;
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

function errorResponse(
  code: WeaverErrorCode,
  message: string,
): RestResponse {
  return {
    status: httpStatusForError(code),
    body: createWeaverError(code, message),
  };
}

export function createRestAdapter(options: RestAdapterOptions): RestAdapter {
  const { configService, corsOrigins } = options;

  // Route params are guaranteed by path matching; this helper satisfies noUncheckedIndexedAccess
  function param(params: Record<string, string>, name: string): string {
    return params[name] as string;
  }

  function queryOpt(query: Record<string, string>, name: string): string | undefined {
    const v = query[name];
    return v === undefined ? undefined : v;
  }

  const routes: RestRoute[] = [
    {
      method: "GET",
      path: "/api/config/:serviceId",
      async handler(req) {
        const tenantId = queryOpt(req.query, "tenantId");
        const opts = tenantId !== undefined ? { tenantId } : {};
        const snapshot = await configService.resolveAll(param(req.params, "serviceId"), opts);
        return { status: 200, body: snapshot };
      },
    },
    {
      method: "GET",
      path: "/api/config/:serviceId/namespace/:prefix",
      async handler(req) {
        const tenantId = queryOpt(req.query, "tenantId");
        const opts = tenantId !== undefined ? { tenantId } : {};
        const entries = await configService.getNamespace(
          param(req.params, "serviceId"),
          param(req.params, "prefix"),
          opts,
        );
        return { status: 200, body: { entries } };
      },
    },
    {
      method: "GET",
      path: "/api/config/:serviceId/inspect/:key",
      async handler(req) {
        const inspection = await configService.inspect(
          param(req.params, "serviceId"),
          param(req.params, "key"),
        );
        return { status: 200, body: inspection };
      },
    },
    {
      method: "GET",
      path: "/api/config/:serviceId/:key",
      async handler(req) {
        const tenantId = queryOpt(req.query, "tenantId");
        const opts = tenantId !== undefined ? { tenantId } : {};
        const value = await configService.get(
          param(req.params, "serviceId"),
          param(req.params, "key"),
          opts,
        );
        return { status: 200, body: { value } };
      },
    },
    {
      method: "PUT",
      path: "/api/config/:layer/:environment/:key",
      async handler(req) {
        const layer = param(req.params, "layer");
        const environment = param(req.params, "environment");
        const key = param(req.params, "key");
        const body = req.body as Record<string, unknown> | undefined;
        const result = await configService.set(layer, key, body?.value, { environment });
        if (!result.success) {
          return errorResponse("VALIDATION_ERROR", result.error ?? "Write failed");
        }
        return { status: 200, body: result };
      },
    },
    {
      method: "DELETE",
      path: "/api/config/:layer/:environment/:key",
      async handler(req) {
        const layer = param(req.params, "layer");
        const environment = param(req.params, "environment");
        const key = param(req.params, "key");
        const result = await configService.remove(layer, key, { environment });
        if (!result.success) {
          return errorResponse("VALIDATION_ERROR", result.error ?? "Remove failed");
        }
        return { status: 200, body: result };
      },
    },
    {
      method: "POST",
      path: "/api/admin/promote",
      async handler() {
        return { status: 501, body: { error: "Not implemented" } };
      },
    },
    {
      method: "POST",
      path: "/api/admin/rollback",
      async handler() {
        return { status: 501, body: { error: "Not implemented" } };
      },
    },
    {
      method: "POST",
      path: "/api/schemas/register",
      async handler() {
        return { status: 501, body: { error: "Not implemented" } };
      },
    },
    {
      method: "GET",
      path: "/api/admin/policies/:serviceId",
      async handler() {
        return { status: 501, body: { error: "Not implemented" } };
      },
    },
    {
      method: "POST",
      path: "/api/admin/policies",
      async handler() {
        return { status: 501, body: { error: "Not implemented" } };
      },
    },
    {
      method: "POST",
      path: "/api/admin/tenants",
      async handler() {
        return { status: 501, body: { error: "Not implemented" } };
      },
    },
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
      return { status: 404, body: createWeaverError("NOT_FOUND", `No route: ${method} ${path}`) };
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
      return { status: 500, body: createWeaverError("VALIDATION_ERROR", message) };
    }
  }

  return { routes, handleRequest };
}
