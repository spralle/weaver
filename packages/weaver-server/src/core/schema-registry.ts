import { z } from "zod";
import type { WeaverConfigService } from "./config-service.js";
import type { WeaverError } from "../types/errors.js";
import { createWeaverError } from "../types/errors.js";

const SchemaDeclaration = z.record(z.string(), z.unknown());
type SchemaDeclaration = z.infer<typeof SchemaDeclaration>;

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

export interface SchemaRegistry {
  register(
    request: SchemaRegistrationRequest,
  ): Promise<SchemaRegistrationResult>;
  getSchema(serviceId: string, environment: string): Promise<unknown | null>;
}

interface SchemaEntry {
  declaration: SchemaDeclaration;
  environment: string;
}

function schemaKey(serviceId: string, environment: string): string {
  return `${serviceId}:${environment}`;
}

function detectBreakingChanges(
  existing: SchemaDeclaration,
  incoming: SchemaDeclaration,
): string[] {
  const changes: string[] = [];

  const existingObj = existing;
  const incomingObj = incoming;

  // Check for removed properties
  const existingProps = getProperties(existingObj);
  const incomingProps = getProperties(incomingObj);

  for (const prop of existingProps) {
    if (!incomingProps.has(prop)) {
      changes.push(`Removed property: ${prop}`);
    }
  }

  // Check for type changes on existing properties
  for (const prop of existingProps) {
    if (incomingProps.has(prop)) {
      const existingType = getPropertyType(existingObj, prop);
      const incomingType = getPropertyType(incomingObj, prop);
      if (existingType && incomingType && existingType !== incomingType) {
        changes.push(`Type changed for "${prop}": ${existingType} → ${incomingType}`);
      }
    }
  }

  return changes;
}

function getProperties(obj: Record<string, unknown>): Set<string> {
  const properties =
    (obj as { properties?: Record<string, unknown> }).properties;
  if (typeof properties === "object" && properties !== null) {
    return new Set(Object.keys(properties));
  }
  return new Set(Object.keys(obj));
}

function getPropertyType(
  obj: Record<string, unknown>,
  prop: string,
): string | undefined {
  const properties =
    (obj as { properties?: Record<string, unknown> }).properties;
  if (typeof properties === "object" && properties !== null) {
    const propDef = properties[prop] as Record<string, unknown> | undefined;
    if (typeof propDef?.type === "string") {
      return propDef.type;
    }
    return undefined;
  }
  const value = obj[prop];
  if (typeof value === "object" && value !== null && "type" in value) {
    const schemaType = (value as Record<string, unknown>).type;
    if (typeof schemaType === "string") {
      return schemaType;
    }
  }
  return undefined;
}

function schemasEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function createSchemaRegistry(
  options: SchemaRegistryOptions,
): SchemaRegistry {
  const schemas = new Map<string, SchemaEntry>();

  return {
    async register(
      request: SchemaRegistrationRequest,
    ): Promise<SchemaRegistrationResult> {
      const { serviceId, environment } = request;

      const parseResult = SchemaDeclaration.safeParse(request.declaration);
      if (!parseResult.success) {
        return {
          success: false,
          isNewSchema: false,
          hasBreakingChanges: false,
          error: createWeaverError(
            "VALIDATION_ERROR",
            `Invalid schema declaration: ${parseResult.error.message}`,
          ),
        };
      }
      const declaration = parseResult.data;

      const key = schemaKey(serviceId, environment);
      const existing = schemas.get(key);

      if (!existing) {
        // New schema
        schemas.set(key, { declaration, environment });
        return {
          success: true,
          isNewSchema: true,
          hasBreakingChanges: false,
        };
      }

      // Check if unchanged (idempotent)
      if (schemasEqual(existing.declaration, declaration)) {
        return {
          success: true,
          isNewSchema: false,
          hasBreakingChanges: false,
        };
      }

      // Detect breaking changes
      const breakingChanges = detectBreakingChanges(
        existing.declaration,
        declaration,
      );

      // Persist updated schema
      schemas.set(key, { declaration, environment });

      const result: SchemaRegistrationResult = {
        success: true,
        isNewSchema: false,
        hasBreakingChanges: breakingChanges.length > 0,
      };
      if (breakingChanges.length > 0) {
        result.breakingChanges = breakingChanges;
      }
      return result;
    },

    async getSchema(
      serviceId: string,
      environment: string,
    ): Promise<unknown | null> {
      const entry = schemas.get(schemaKey(serviceId, environment));
      return entry?.declaration ?? null;
    },
  };
}
