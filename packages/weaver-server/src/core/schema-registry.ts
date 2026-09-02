import {
  deriveFragmentPath,
  deriveServicePath,
  detectBreakingChanges,
  schemasEqual,
} from "@weaver-conf/config-engine";
import type {
  ConfigurationPropertySchema,
  SchemaRegistrationRequest as PathSchemaRegistrationRequest,
  SchemaRegistrationMetadata,
} from "@weaver-conf/config-types";
import {
  configurationPropertySchemaSchema,
  fragmentSchemaRegistrationRequestSchema,
  serviceSchemaRegistrationRequestSchema,
} from "@weaver-conf/config-types";
import type { WeaverError } from "../types/errors";
import { createWeaverError } from "../types/errors";
import type { WeaverConfigService } from "./config-service";

export type SchemaRegistrationRequest = PathSchemaRegistrationRequest;

export interface SchemaRegistrationResult {
  success: boolean;
  isNewSchema: boolean;
  hasBreakingChanges: boolean;
  metadata?: SchemaRegistrationMetadata | undefined;
  breakingChanges?: string[];
  error?: WeaverError;
}

export interface SchemaRegistryOptions {
  configService: WeaverConfigService;
}

export interface PersistentSchemaRegistryOptions extends SchemaRegistryOptions {
  layer?: string;
  key?: string;
  environment?: string;
}

export interface SchemaRegistry {
  register(
    request: SchemaRegistrationRequest,
  ): Promise<SchemaRegistrationResult>;
  getSchema(serviceId: string, environment: string): Promise<unknown | null>;
  listAll(): Record<string, ConfigurationPropertySchema>;
}

interface SchemaEntry {
  schema: ConfigurationPropertySchema;
  environment: string;
  metadata: SchemaRegistrationMetadata;
}

type PersistedSchemaRegistry = Record<
  string,
  Record<string, ConfigurationPropertySchema>
>;

interface RegistrationEvaluation {
  result: SchemaRegistrationResult;
  entry?: SchemaEntry;
  key?: string;
}

const defaultPersistenceLayer = "platform";
const defaultPersistenceKey = "_weaver.registry.schemas";

function schemaKey(path: string, environment: string): string {
  return `${path}:${environment}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function evaluateRegistration(
  schemas: ReadonlyMap<string, SchemaEntry>,
  request: SchemaRegistrationRequest,
): RegistrationEvaluation {
  const parsed = parseRegistrationRequest(request);
  if (!parsed.success) return { result: parsed.result };

  const { schema, environment, metadata, targetPath } = parsed;
  const key = schemaKey(targetPath, environment);
  const existing = schemas.get(key);
  if (existing) {
    return { ...evaluateExistingRegistration(existing, schema, metadata), key };
  }
  return {
    result: {
      success: true,
      isNewSchema: true,
      hasBreakingChanges: false,
      metadata,
    },
    entry: { schema, environment, metadata },
    key,
  };
}

function evaluateExistingRegistration(
  existing: SchemaEntry,
  schema: ConfigurationPropertySchema,
  metadata: SchemaRegistrationMetadata,
): RegistrationEvaluation {
  if (schemasEqual(existing.schema, schema)) {
    return {
      result: {
        success: true,
        isNewSchema: false,
        hasBreakingChanges: false,
        metadata,
      },
    };
  }

  const breakingChanges = detectBreakingChanges(existing.schema, schema);
  const result: SchemaRegistrationResult = {
    success: true,
    isNewSchema: false,
    hasBreakingChanges: breakingChanges.length > 0,
    metadata,
  };
  if (breakingChanges.length > 0) {
    result.breakingChanges = breakingChanges.map((c) => c.message);
  }
  return {
    result,
    entry: { schema, environment: existing.environment, metadata },
  };
}

type ParsedRegistration =
  | {
      readonly success: true;
      readonly schema: ConfigurationPropertySchema;
      readonly environment: string;
      readonly metadata: SchemaRegistrationMetadata;
      readonly targetPath: string;
    }
  | { readonly success: false; readonly result: SchemaRegistrationResult };

function parseRegistrationRequest(
  request: SchemaRegistrationRequest,
): ParsedRegistration {
  try {
    if ("providerId" in request) return parseFragmentRegistration(request);
    return parseServiceRegistration(request);
  } catch (error: unknown) {
    return validationFailure(errorMessage(error));
  }
}

function parseServiceRegistration(
  request: SchemaRegistrationRequest,
): ParsedRegistration {
  const parsed = serviceSchemaRegistrationRequestSchema.safeParse(request);
  if (!parsed.success) return validationFailure(parsed.error.message);
  const metadata = deriveServicePath(parsed.data.serviceId);
  return {
    success: true,
    schema: parsed.data.schema,
    environment: parsed.data.environment,
    metadata: { ...metadata, environment: parsed.data.environment },
    targetPath: metadata.servicePath,
  };
}

function parseFragmentRegistration(
  request: SchemaRegistrationRequest,
): ParsedRegistration {
  const parsed = fragmentSchemaRegistrationRequestSchema.safeParse(request);
  if (!parsed.success) return validationFailure(parsed.error.message);
  const metadata = deriveFragmentPath(
    parsed.data.serviceId,
    parsed.data.slotPath,
    parsed.data.providerId,
  );
  return {
    success: true,
    schema: parsed.data.schema,
    environment: parsed.data.environment,
    metadata: { ...metadata, environment: parsed.data.environment },
    targetPath: metadata.fragmentPath,
  };
}

function validationFailure(message: string): ParsedRegistration {
  return {
    success: false,
    result: {
      success: false,
      isNewSchema: false,
      hasBreakingChanges: false,
      error: createWeaverError("VALIDATION_ERROR", message),
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function serializeSchemas(
  schemas: ReadonlyMap<string, SchemaEntry>,
): PersistedSchemaRegistry {
  const persisted: PersistedSchemaRegistry = {};
  for (const [key, entry] of schemas) {
    const serviceId = key.slice(0, key.length - entry.environment.length - 1);
    persisted[serviceId] = persisted[serviceId] ?? {};
    persisted[serviceId][entry.environment] = entry.schema;
  }
  return persisted;
}

function parsePersistedSchemas(raw: unknown): Map<string, SchemaEntry> {
  const schemas = new Map<string, SchemaEntry>();
  if (raw === undefined || raw === null) return schemas;
  if (!isRecord(raw))
    throw new Error("Persisted schema registry must be an object");

  for (const [path, environments] of Object.entries(raw)) {
    if (!isRecord(environments)) {
      throw new Error(`Persisted schemas for "${path}" must be an object`);
    }
    parsePersistedServiceSchemas(schemas, path, environments);
  }
  return schemas;
}

function parsePersistedServiceSchemas(
  schemas: Map<string, SchemaEntry>,
  path: string,
  environments: Record<string, unknown>,
): void {
  for (const [environment, schema] of Object.entries(environments)) {
    const parsed = configurationPropertySchemaSchema.parse(schema);
    const persistedPath = path.startsWith("/") ? path : `/${path}`;
    const serviceId = persistedPath.split("/").filter(Boolean)[0] ?? path;
    schemas.set(schemaKey(persistedPath, environment), {
      schema: parsed,
      environment,
      metadata: { serviceId, servicePath: persistedPath, environment },
    });
  }
}

function listSchemas(
  schemas: ReadonlyMap<string, SchemaEntry>,
): Record<string, ConfigurationPropertySchema> {
  const result: Record<string, ConfigurationPropertySchema> = {};
  for (const [key, entry] of schemas) {
    result[key] = entry.schema;
  }
  return result;
}

function createSchemaPersistenceWriter(
  options: PersistentSchemaRegistryOptions,
  layer: string,
  key: string,
): (
  updatedSchemas: ReadonlyMap<string, SchemaEntry>,
  environment: string,
) => Promise<SchemaRegistrationResult | null> {
  return async (updatedSchemas, environment) => {
    const writeResult = await options.configService.set(
      layer,
      key,
      serializeSchemas(updatedSchemas),
      { environment },
    );
    if (writeResult.success) return null;
    return {
      success: false,
      isNewSchema: false,
      hasBreakingChanges: false,
      error: createWeaverError(
        "INTERNAL_ERROR",
        writeResult.error?.message ?? "Failed to persist schema registry",
      ),
    };
  };
}

export function createSchemaRegistry(
  _options: SchemaRegistryOptions,
): SchemaRegistry {
  const schemas = new Map<string, SchemaEntry>();

  return {
    async register(
      request: SchemaRegistrationRequest,
    ): Promise<SchemaRegistrationResult> {
      const evaluation = evaluateRegistration(schemas, request);
      if (evaluation.entry && evaluation.key) {
        schemas.set(evaluation.key, evaluation.entry);
      }
      return evaluation.result;
    },

    async getSchema(
      serviceId: string,
      environment: string,
    ): Promise<unknown | null> {
      try {
        const { servicePath } = deriveServicePath(serviceId);
        const entry = schemas.get(schemaKey(servicePath, environment));
        return entry?.schema ?? null;
      } catch {
        return null;
      }
    },

    listAll(): Record<string, ConfigurationPropertySchema> {
      return listSchemas(schemas);
    },
  };
}

export async function createPersistentSchemaRegistry(
  options: PersistentSchemaRegistryOptions,
): Promise<SchemaRegistry> {
  const layer = options.layer ?? defaultPersistenceLayer;
  const key = options.key ?? defaultPersistenceKey;
  const defaultEnvironment = options.environment;
  const schemas = parsePersistedSchemas(await options.configService.get(key));
  const persist = createSchemaPersistenceWriter(options, layer, key);

  return {
    async register(request) {
      const environment = request.environment || defaultEnvironment || "";
      const normalizedRequest = { ...request, environment };
      const evaluation = evaluateRegistration(schemas, normalizedRequest);
      if (!evaluation.result.success || !evaluation.entry || !evaluation.key)
        return evaluation.result;

      const updatedSchemas = new Map(schemas);
      updatedSchemas.set(evaluation.key, evaluation.entry);
      const persistenceFailure = await persist(updatedSchemas, environment);
      if (persistenceFailure) return persistenceFailure;
      schemas.set(evaluation.key, evaluation.entry);
      return evaluation.result;
    },

    async getSchema(serviceId, environment) {
      try {
        const { servicePath } = deriveServicePath(serviceId);
        const entry = schemas.get(schemaKey(servicePath, environment));
        return entry?.schema ?? null;
      } catch {
        return null;
      }
    },

    listAll() {
      return listSchemas(schemas);
    },
  };
}
