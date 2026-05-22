import type { ClientSchemaRegistry, ValidationResult } from "./schema-registry";

export type { ValidationResult } from "./schema-registry";

export interface ValidationOptions {
  warnOnMismatch: boolean;
  logger?: { warn: (msg: string) => void };
}

export interface SchemaOptions {
  /** Subscribe to schema changes from server (default: true) */
  live?: boolean;
  /** Log warnings when values don't match server schema (default: true) */
  warnOnMismatch?: boolean;
}

/**
 * Validate a value on read. Logs warning if invalid but returns value (soft gate).
 */
export function validateOnRead<T>(
  key: string,
  value: T,
  registry: ClientSchemaRegistry | undefined,
  options: ValidationOptions,
): T | undefined {
  if (!registry || value === undefined) return value;

  const result = registry.validate(key, value);
  if (result.valid) return value;

  if (options.warnOnMismatch) {
    const errors = result.errors?.map((e) => e.message).join(", ") ?? "unknown";
    (options.logger ?? console).warn(
      `[weaver] Schema mismatch for "${key}": ${errors}. Value returned anyway.`,
    );
  }
  return value;
}

/**
 * Validate before write. If invalid, the write should be rejected.
 */
export function validateOnWrite(
  key: string,
  value: unknown,
  registry: ClientSchemaRegistry | undefined,
): ValidationResult {
  if (!registry) return { valid: true };
  return registry.validate(key, value);
}
