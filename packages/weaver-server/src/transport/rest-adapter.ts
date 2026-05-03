// REST transport adapter — maps HTTP routes to WeaverConfigService
import type { WeaverConfigService, WriteContext } from "../core/config-service.js";
import type { ScopeManager } from "../core/scope-manager.js";
import { createWeaverError, httpStatusForError } from "../types/index.js";
import type { WeaverErrorCode, WeaverError } from "../types/index.js";
import { parseScopeQuery } from "../core/scope-utils.js";
import { buildPath } from "@weaver/config-engine";
import { ZodError } from "zod";
import {
  configWriteBodySchema,
  configBatchBodySchema,
  scopeProvisionBodySchema,
} from "./rest-schemas.js";
import type { AuthContext } from "../auth/auth-middleware.js";
import type { ConfigurationPropertySchema } from "@weaver/config-types";
import type { AuthGate } from "./auth-gate.js";
import {
  matchPath,
  corsHeaders,
  envelope,
  errorEnvelope,
  v1Headers,
} from "./rest-helpers.js";
export type { ApiResponse, ApiErrorResponse } from "./rest-helpers.js";

export interface RestRoute {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  handler: (req: RestRequest) => Promise<RestResponse>;
}

export interface RestRequest {
  params: Record<string, string>;
  query: Record<string, string>;
  body?: unknown;
  headers: Record<string, string>;
  authContext?: AuthContext;
  schemaMap?: Map<string, ConfigurationPropertySchema>;
}

export interface RestResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface RestAdapterOptions {
  configService: WeaverConfigService;
  scopeManager?: ScopeManager;
  corsOrigins?: string[];
  authGate?: AuthGate;
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

export function createRestAdapter(options: RestAdapterOptions): RestAdapter {
  const { configService, scopeManager, corsOrigins, authGate } = options;

  function param(params: Record<string, string>, name: string): string {
    const value = params[name];
    if (!value) {
      throw createWeaverError("VALIDATION_ERROR", `Missing required route parameter: ${name}`);
    }
    return value;
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

  function extractExpectedRevision(req: RestRequest): string | undefined {
    const ifMatch = req.headers["if-match"];
    if (ifMatch === undefined) return undefined;
    return ifMatch.replace(/^"|"$/g, "");
  }

  function writeErrorResponse(result: { error?: string | undefined }, fallback: string): RestResponse {
    const msg = result.error ?? fallback;
    const isConflict = msg.includes("Revision conflict");
    const code: WeaverErrorCode = isConflict ? "REVISION_CONFLICT" : "VALIDATION_ERROR";
    const status = isConflict ? 409 : httpStatusForError(code);
    const rev = configService.revision;
    return { status, body: errorEnvelope(createWeaverError(code, msg), rev), headers: v1Headers(rev) };
  }

  const routes: RestRoute[] = [
    {
      method: "GET",
      path: "/v1/config",
      async handler(req) {
        const scopePath = parseScopeQuery(queryOpt(req.query, "scope"));
        const opts = scopePath ? { scopePath } : {};
        const snapshot = await configService.resolveAll(opts);
        if (authGate && req.authContext) {
          const accessCtx = authGate.toAccessContext(req.authContext);
          const filtered = authGate.filterVisible(accessCtx, snapshot, req.schemaMap ?? new Map());
          return v1Response(200, filtered);
        }
        return v1Response(200, snapshot);
      },
    },
    {
      method: "GET",
      path: "/v1/config/*keyPath",
      async handler(req) {
        const keyPath = param(req.params, "keyPath");
        const segments = keyPath.split("/");
        const key = buildPath(segments);
        const scopePath = parseScopeQuery(queryOpt(req.query, "scope"));
        const opts = scopePath ? { scopePath } : {};
        if (authGate && req.authContext) {
          const accessCtx = authGate.toAccessContext(req.authContext);
          const denied = authGate.gateRead(accessCtx, key, req.schemaMap?.get(key));
          if (denied) return denied;
        }
        if ("inspect" in req.query) {
          const inspection = await configService.inspect(key);
          return v1Response(200, inspection);
        }
        const value = await configService.get(key, opts);
        return v1Response(200, { key, value });
      },
    },
    {
      method: "PUT",
      path: "/v1/config/*keyPath",
      async handler(req) {
        const keyPath = param(req.params, "keyPath");
        const segments = keyPath.split("/");
        const key = buildPath(segments);
        const layer = queryOpt(req.query, "layer") ?? "platform";
        const environment = queryOpt(req.query, "env");
        if (authGate && req.authContext) {
          const accessCtx = authGate.toAccessContext(req.authContext);
          const denied = authGate.gateWrite(accessCtx, layer, key, req.schemaMap?.get(key));
          if (denied) return denied;
        }
        const body = configWriteBodySchema.parse(req.body);
        const expectedRevision = extractExpectedRevision(req);
        const writeCtx: WriteContext = {};
        if (expectedRevision) writeCtx.expectedRevision = expectedRevision;
        if (environment) writeCtx.environment = environment;
        const result = await configService.set(layer, key, body.value, writeCtx);
        if (!result.success) return writeErrorResponse(result, "Write failed");
        return v1Response(200, result);
      },
    },
    {
      method: "DELETE",
      path: "/v1/config/*keyPath",
      async handler(req) {
        const keyPath = param(req.params, "keyPath");
        const segments = keyPath.split("/");
        const key = buildPath(segments);
        const layer = queryOpt(req.query, "layer") ?? "platform";
        const environment = queryOpt(req.query, "env");
        if (authGate && req.authContext) {
          const accessCtx = authGate.toAccessContext(req.authContext);
          const denied = authGate.gateWrite(accessCtx, layer, key, req.schemaMap?.get(key));
          if (denied) return denied;
        }
        const expectedRevision = extractExpectedRevision(req);
        const writeCtx: WriteContext = {};
        if (expectedRevision) writeCtx.expectedRevision = expectedRevision;
        if (environment) writeCtx.environment = environment;
        const result = await configService.remove(layer, key, writeCtx);
        if (!result.success) return writeErrorResponse(result, "Remove failed");
        return v1Response(200, result);
      },
    },
    {
      method: "PATCH",
      path: "/v1/config",
      async handler(req) {
        const layer = queryOpt(req.query, "layer") ?? "platform";
        const environment = queryOpt(req.query, "env");
        const body = configBatchBodySchema.parse(req.body);
        const entries = body.entries;
        if (authGate && req.authContext) {
          const accessCtx = authGate.toAccessContext(req.authContext);
          for (const key of Object.keys(entries)) {
            const denied = authGate.gateWrite(accessCtx, layer, key, req.schemaMap?.get(key));
            if (denied) return denied;
          }
        }
        const expectedRevision = extractExpectedRevision(req);
        const writeCtx: WriteContext = {};
        if (expectedRevision) writeCtx.expectedRevision = expectedRevision;
        if (environment) writeCtx.environment = environment;
        const result = await configService.setMany(layer, entries, writeCtx);
        if (!result.success) return writeErrorResponse(result, "Batch write failed");
        return v1Response(200, { ...result, written: Object.keys(entries).length });
      },
    },
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

    {
      method: "POST",
      path: "/v1/admin/scopes/:scopeId",
      async handler(req) {
        if (!scopeManager) {
          return v1Error("VALIDATION_ERROR", "Scope manager not configured");
        }
        const scopeId = param(req.params, "scopeId");
        const body = scopeProvisionBodySchema.parse(req.body);
        const value = body.value;
        const displayName = body.displayName;
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
          return v1Error("VALIDATION_ERROR", "Scope manager not configured");
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
      if (err instanceof ZodError) {
        const rev = configService.revision;
        return {
          status: 400,
          body: errorEnvelope(
            createWeaverError("VALIDATION_ERROR", "Request validation failed", { issues: err.issues }),
            rev,
          ),
          headers: v1Headers(rev),
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      const rev = configService.revision;
      return {
        status: 500,
        body: errorEnvelope(createWeaverError("INTERNAL_ERROR", message), rev),
        headers: v1Headers(rev),
      };
    }
  }

  return { routes, handleRequest };
}
