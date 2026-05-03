import {
  detectBreakingChanges,
  schemasEqual,
} from "@weaver/config-engine";
import { z } from "zod";
import type { WeaverError } from "../types/errors.js";
import { createWeaverError } from "../types/errors.js";
import type { WeaverConfigService } from "./config-service.js";

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
        result.breakingChanges = breakingChanges.map((c) => c.message);
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
