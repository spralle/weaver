import {
  detectBreakingChanges,
  schemasEqual,
} from "@weaver-conf/config-engine";
import type { ConfigurationPropertySchema } from "@weaver-conf/config-types";
import { configurationPropertySchemaSchema } from "@weaver-conf/config-types";
import type { WeaverError } from "../types/errors";
import { createWeaverError } from "../types/errors";
import type { WeaverConfigService } from "./config-service";

export interface SchemaRegistrationRequest {
  serviceId: string;
  declaration: unknown;
  environment: string;
}

export interface SchemaRegistrationResult {
  success: boolean;
  isNewSchema: boolean;
  hasBreakingChanges: boolean;
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
  declaration: ConfigurationPropertySchema;
  environment: string;
}

type PersistedSchemaRegistry = Record<
  string,
  Record<string, ConfigurationPropertySchema>
>;

interface RegistrationEvaluation {
  result: SchemaRegistrationResult;
  entry?: SchemaEntry;
}

const defaultPersistenceLayer = "platform";
const defaultPersistenceKey = "_weaver.schemas";

function schemaKey(serviceId: string, environment: string): string {
  return `${serviceId}:${environment}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function evaluateRegistration(
  schemas: ReadonlyMap<string, SchemaEntry>,
  request: SchemaRegistrationRequest,
): RegistrationEvaluation {
  const parseResult = configurationPropertySchemaSchema.safeParse(
    request.declaration,
  );
  if (!parseResult.success) {
    return {
      result: {
        success: false,
        isNewSchema: false,
        hasBreakingChanges: false,
        error: createWeaverError(
          "VALIDATION_ERROR",
          `Invalid schema declaration: ${parseResult.error.message}`,
        ),
      },
    };
  }

  const declaration = parseResult.data;
  const key = schemaKey(request.serviceId, request.environment);
  const existing = schemas.get(key);
  return existing
    ? evaluateExistingRegistration(existing, declaration)
    : {
        result: { success: true, isNewSchema: true, hasBreakingChanges: false },
        entry: { declaration, environment: request.environment },
      };
}

function evaluateExistingRegistration(
  existing: SchemaEntry,
  declaration: ConfigurationPropertySchema,
): RegistrationEvaluation {
  if (schemasEqual(existing.declaration, declaration)) {
    return {
      result: { success: true, isNewSchema: false, hasBreakingChanges: false },
    };
  }

  const breakingChanges = detectBreakingChanges(
    existing.declaration,
    declaration,
  );
  const result: SchemaRegistrationResult = {
    success: true,
    isNewSchema: false,
    hasBreakingChanges: breakingChanges.length > 0,
  };
  if (breakingChanges.length > 0) {
    result.breakingChanges = breakingChanges.map((c) => c.message);
  }
  return { result, entry: { declaration, environment: existing.environment } };
}

function serializeSchemas(
  schemas: ReadonlyMap<string, SchemaEntry>,
): PersistedSchemaRegistry {
  const persisted: PersistedSchemaRegistry = {};
  for (const [key, entry] of schemas) {
    const serviceId = key.slice(0, key.length - entry.environment.length - 1);
    persisted[serviceId] = persisted[serviceId] ?? {};
    persisted[serviceId][entry.environment] = entry.declaration;
  }
  return persisted;
}

function parsePersistedSchemas(raw: unknown): Map<string, SchemaEntry> {
  const schemas = new Map<string, SchemaEntry>();
  if (raw === undefined || raw === null) return schemas;
  if (!isRecord(raw))
    throw new Error("Persisted schema registry must be an object");

  for (const [serviceId, environments] of Object.entries(raw)) {
    if (!isRecord(environments)) {
      throw new Error(`Persisted schemas for "${serviceId}" must be an object`);
    }
    parsePersistedServiceSchemas(schemas, serviceId, environments);
  }
  return schemas;
}

function parsePersistedServiceSchemas(
  schemas: Map<string, SchemaEntry>,
  serviceId: string,
  environments: Record<string, unknown>,
): void {
  for (const [environment, declaration] of Object.entries(environments)) {
    const parsed = configurationPropertySchemaSchema.parse(declaration);
    schemas.set(schemaKey(serviceId, environment), {
      declaration: parsed,
      environment,
    });
  }
}

function listSchemas(
  schemas: ReadonlyMap<string, SchemaEntry>,
): Record<string, ConfigurationPropertySchema> {
  const result: Record<string, ConfigurationPropertySchema> = {};
  for (const [key, entry] of schemas) {
    result[key] = entry.declaration;
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
      const { serviceId, environment } = request;
      const key = schemaKey(serviceId, environment);
      const evaluation = evaluateRegistration(schemas, request);
      if (evaluation.entry) schemas.set(key, evaluation.entry);
      return evaluation.result;
    },

    async getSchema(
      serviceId: string,
      environment: string,
    ): Promise<unknown | null> {
      const entry = schemas.get(schemaKey(serviceId, environment));
      return entry?.declaration ?? null;
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
      const key = schemaKey(request.serviceId, environment);
      const evaluation = evaluateRegistration(schemas, normalizedRequest);
      if (!evaluation.result.success || !evaluation.entry)
        return evaluation.result;

      const updatedSchemas = new Map(schemas);
      updatedSchemas.set(key, evaluation.entry);
      const persistenceFailure = await persist(updatedSchemas, environment);
      if (persistenceFailure) return persistenceFailure;
      schemas.set(key, evaluation.entry);
      return evaluation.result;
    },

    async getSchema(serviceId, environment) {
      const entry = schemas.get(schemaKey(serviceId, environment));
      return entry?.declaration ?? null;
    },

    listAll() {
      return listSchemas(schemas);
    },
  };
}
