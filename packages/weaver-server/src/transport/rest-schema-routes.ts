import { buildPath } from "@weaver-conf/config-engine";
import type { WriteResult } from "@weaver-conf/config-types";
import type {
  EffectiveValidationContext,
  WeaverConfigService,
  WriteContext,
} from "../core/config-service";
import type {
  SchemaRegistrationResult,
  SchemaRegistry,
} from "../core/schema-registry";
import { parseScopeQuery } from "../core/scope-utils";
import type { WeaverErrorCode } from "../types/index";
import { createWeaverError, httpStatusForError } from "../types/index";
import type { AuthGate } from "./auth-gate";
import type { RestRequest, RestResponse, RestRoute } from "./rest-adapter";
import { envelope, errorEnvelope, v1Headers } from "./rest-helpers";
import {
  fragmentSchemaRegistrationBodySchema,
  registeredEffectiveValidationQuerySchema,
  registeredObjectWriteBodySchema,
  registeredPathPatchBodySchema,
  serviceSchemaRegistrationBodySchema,
} from "./rest-schemas";

export interface SchemaRouteDeps {
  configService: WeaverConfigService;
  schemaRegistry?: SchemaRegistry | undefined;
  authGate?: AuthGate | undefined;
}

function v1Response<T>(
  configService: WeaverConfigService,
  status: number,
  data: T,
): RestResponse {
  const rev = configService.revision;
  return { status, body: envelope(data, rev), headers: v1Headers(rev) };
}

function v1Error(
  configService: WeaverConfigService,
  code: WeaverErrorCode,
  message: string,
  details?: Record<string, unknown>,
): RestResponse {
  const rev = configService.revision;
  const err = createWeaverError(code, message, details);
  return {
    status: httpStatusForError(code),
    body: errorEnvelope(err, rev),
    headers: v1Headers(rev),
  };
}

function unavailable(configService: WeaverConfigService): RestResponse {
  return v1Error(
    configService,
    "VALIDATION_ERROR",
    "Schema registry not configured",
  );
}

function canonicalRoutePath(
  params: Record<string, string>,
  name: string,
): string {
  const value = params[name];
  if (!value) {
    throw createWeaverError(
      "VALIDATION_ERROR",
      `Missing required route parameter: ${name}`,
    );
  }
  return `/${value}`;
}

function extractExpectedRevision(req: RestRequest): string | undefined {
  const ifMatch = req.headers["if-match"];
  if (ifMatch === undefined) return undefined;
  return ifMatch.replace(/^"|"$/g, "");
}

const schemaRegistryAdminKey = "_weaver.registry.schemas";

function storageKeyFromCanonicalPath(path: string): string {
  return buildPath(path.slice(1).split("/"));
}

function gateRead(
  req: RestRequest,
  deps: SchemaRouteDeps,
  key: string,
): RestResponse | null {
  if (!deps.authGate) return null;
  if (!req.authContext) return authContextRequired(deps.configService);
  const accessCtx = deps.authGate.toAccessContext(req.authContext);
  return deps.authGate.gateRead(accessCtx, key, req.schemaMap?.get(key));
}

function gateWrite(
  req: RestRequest,
  deps: SchemaRouteDeps,
  layer: string,
  key: string,
): RestResponse | null {
  if (!deps.authGate) return null;
  if (!req.authContext) return authContextRequired(deps.configService);
  const accessCtx = deps.authGate.toAccessContext(req.authContext);
  return deps.authGate.gateWrite(
    accessCtx,
    layer,
    key,
    req.schemaMap?.get(key),
  );
}

function authContextRequired(configService: WeaverConfigService): RestResponse {
  return v1Error(configService, "UNAUTHORIZED", "Authentication required");
}

function writeContext(req: RestRequest): WriteContext {
  const expectedRevision = extractExpectedRevision(req);
  const environment = req.query.env;
  return {
    ...(expectedRevision ? { expectedRevision } : {}),
    ...(environment ? { environment } : {}),
  };
}

function writeFailureResponse(
  configService: WeaverConfigService,
  fallback: string,
  result: WriteResult,
): RestResponse {
  const error = result.error;
  const code: WeaverErrorCode =
    error?.code === "REVISION_CONFLICT"
      ? "REVISION_CONFLICT"
      : "VALIDATION_ERROR";
  const status = code === "REVISION_CONFLICT" ? 409 : httpStatusForError(code);
  const rev = configService.revision;
  const details = isRecord(error?.details) ? error.details : undefined;
  return {
    status,
    body: errorEnvelope(
      createWeaverError(code, error?.message ?? fallback, details),
      rev,
    ),
    headers: v1Headers(rev),
  };
}

export function buildSchemaRoutes(deps: SchemaRouteDeps): RestRoute[] {
  return [
    listSchemasRoute(deps),
    registerServiceRoute(deps),
    registerFragmentRoute(deps),
    setRegisteredObjectRoute(deps),
    patchRegisteredPathRoute(deps),
    validateRegisteredEffectiveRoute(deps),
  ];
}

function listSchemasRoute(deps: SchemaRouteDeps): RestRoute {
  const { configService, schemaRegistry } = deps;
  return {
    method: "GET",
    path: "/v1/admin/schemas",
    async handler(req) {
      if (!schemaRegistry) return unavailable(configService);
      const denied = gateRead(req, deps, schemaRegistryAdminKey);
      if (denied) return denied;
      return v1Response(configService, 200, {
        schemas: schemaRegistry.listAll(),
      });
    },
  };
}

function registerServiceRoute(deps: SchemaRouteDeps): RestRoute {
  const { configService, schemaRegistry } = deps;
  return {
    method: "POST",
    path: "/v1/admin/schemas/services",
    async handler(req) {
      if (!schemaRegistry) return unavailable(configService);
      const denied = gateWrite(req, deps, "admin", schemaRegistryAdminKey);
      if (denied) return denied;
      const body = serviceSchemaRegistrationBodySchema.parse(req.body);
      const result = await schemaRegistry.register(
        body,
        registrationContext(req),
      );
      if (!result.success) return registrationFailure(configService, result);
      return v1Response(configService, 201, result);
    },
  };
}

function registerFragmentRoute(deps: SchemaRouteDeps): RestRoute {
  const { configService, schemaRegistry } = deps;
  return {
    method: "POST",
    path: "/v1/admin/schemas/fragments",
    async handler(req) {
      if (!schemaRegistry) return unavailable(configService);
      const denied = gateWrite(req, deps, "admin", schemaRegistryAdminKey);
      if (denied) return denied;
      const body = fragmentSchemaRegistrationBodySchema.parse(req.body);
      const result = await schemaRegistry.register(
        body,
        registrationContext(req),
      );
      if (!result.success) return registrationFailure(configService, result);
      return v1Response(configService, 201, result);
    },
  };
}

function setRegisteredObjectRoute(deps: SchemaRouteDeps): RestRoute {
  const { configService, schemaRegistry } = deps;
  return {
    method: "PUT",
    path: "/v1/registered/objects/*anchorPath",
    async handler(req) {
      if (!schemaRegistry) return unavailable(configService);
      const layer = req.query.layer ?? "platform";
      const anchorPath = canonicalRoutePath(req.params, "anchorPath");
      const key = storageKeyFromCanonicalPath(anchorPath);
      const denied = gateWrite(req, deps, layer, key);
      if (denied) return denied;
      const body = registeredObjectWriteBodySchema.parse(req.body);
      const result = await configService.setRegisteredObject(
        layer,
        anchorPath,
        body.value,
        { ...writeContext(req), schemaRegistry },
      );
      if (!result.success) {
        return writeFailureResponse(
          configService,
          "Registered object write failed",
          result,
        );
      }
      return v1Response(configService, 200, result);
    },
  };
}

function patchRegisteredPathRoute(deps: SchemaRouteDeps): RestRoute {
  const { configService, schemaRegistry } = deps;
  return {
    method: "PATCH",
    path: "/v1/registered/paths/*path",
    async handler(req) {
      if (!schemaRegistry) return unavailable(configService);
      const layer = req.query.layer ?? "platform";
      const path = canonicalRoutePath(req.params, "path");
      const key = storageKeyFromCanonicalPath(path);
      const denied = gateWrite(req, deps, layer, key);
      if (denied) return denied;
      const body = registeredPathPatchBodySchema.parse(req.body);
      const result = await configService.patchRegisteredPath(
        layer,
        path,
        body.value,
        { ...writeContext(req), schemaRegistry },
      );
      if (!result.success) {
        return writeFailureResponse(
          configService,
          "Registered path patch failed",
          result,
        );
      }
      return v1Response(configService, 200, result);
    },
  };
}

function validateRegisteredEffectiveRoute(deps: SchemaRouteDeps): RestRoute {
  const { configService, schemaRegistry } = deps;
  return {
    method: "GET",
    path: "/v1/registered/effective/*anchorPath",
    async handler(req) {
      if (!schemaRegistry) return unavailable(configService);
      const anchorPath = canonicalRoutePath(req.params, "anchorPath");
      const key = storageKeyFromCanonicalPath(anchorPath);
      const denied = gateRead(req, deps, key);
      if (denied) return denied;
      const validation = await configService.validateRegisteredEffective(
        anchorPath,
        effectiveValidationContext(req, schemaRegistry),
      );
      return v1Response(
        configService,
        validation.valid ? 200 : 422,
        validation,
      );
    },
  };
}

function registrationContext(req: RestRequest) {
  const identity = req.authContext?.identity;
  if (!identity) return undefined;
  const subject = identity.serviceId ?? identity.userId;
  return subject ? { subject, actor: subject } : undefined;
}

function effectiveValidationContext(
  req: RestRequest,
  schemaRegistry: SchemaRegistry,
): EffectiveValidationContext {
  const query = registeredEffectiveValidationQuerySchema.parse(req.query);
  const scopePath = query.scope ? parseScopeQuery(query.scope) : undefined;
  return {
    schemaRegistry,
    ...(query.environment ? { environment: query.environment } : {}),
    ...(scopePath ? { scopePath } : {}),
  };
}

function registrationFailure(
  configService: WeaverConfigService,
  result: SchemaRegistrationResult,
): RestResponse {
  return v1Error(
    configService,
    "VALIDATION_ERROR",
    result.error?.message ?? "Schema registration failed",
    result.error?.details,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
