import { getCachedRegex, isSafePattern } from "@weaver-conf/config-engine";
import type {
  ConfigReloadBehavior,
  ConfigurationPropertySchema,
} from "@weaver-conf/config-types";

/** Result of validating a value against its registered schema. */
export interface ValidationResult {
  valid: boolean;
  errors?: ReadonlyArray<{ path: string; message: string }>;
}

/** Client-side schema registry for runtime validation, sensitivity checks, and reload tracking. */
export interface ClientSchemaRegistry {
  load(schemas: Record<string, ConfigurationPropertySchema>): void;
  getSchema(key: string): ConfigurationPropertySchema | undefined;
  isSensitive(key: string): boolean;
  getReloadBehavior(key: string): ConfigReloadBehavior | undefined;
  getRestartRequiredKeys(): ReadonlyArray<string>;
  validate(key: string, value: unknown): ValidationResult;
}

/** Creates a client-side schema registry for validating config values against server schemas. */
export function createClientSchemaRegistry(): ClientSchemaRegistry {
  const schemas = new Map<string, ConfigurationPropertySchema>();

  function load(input: Record<string, ConfigurationPropertySchema>): void {
    schemas.clear();
    for (const [key, schema] of Object.entries(input)) {
      schemas.set(key, schema);
    }
  }

  function getSchema(key: string): ConfigurationPropertySchema | undefined {
    return schemas.get(key);
  }

  function isSensitive(key: string): boolean {
    const schema = schemas.get(key);
    return schema?.["x-weaver"]?.sensitive === true;
  }

  function getReloadBehavior(key: string): ConfigReloadBehavior | undefined {
    return schemas.get(key)?.["x-weaver"]?.reloadBehavior;
  }

  function getRestartRequiredKeys(): ReadonlyArray<string> {
    const keys: string[] = [];
    for (const [key, schema] of schemas) {
      if (schema["x-weaver"]?.reloadBehavior === "restart-required") {
        keys.push(key);
      }
    }
    return keys;
  }

  function validate(key: string, value: unknown): ValidationResult {
    const schema = schemas.get(key);
    if (!schema) return { valid: true };
    const errors: Array<{ path: string; message: string }> = [];
    validateValue(schema, value, "", errors);
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  return {
    load,
    getSchema,
    isSensitive,
    getReloadBehavior,
    getRestartRequiredKeys,
    validate,
  };
}

function validateValue(
  schema: ConfigurationPropertySchema,
  value: unknown,
  path: string,
  errors: Array<{ path: string; message: string }>,
): void {
  if (!checkType(schema, value, path, errors)) return;
  checkEnum(schema, value, path, errors);
  checkConst(schema, value, path, errors);
  if (typeof value === "string") checkString(schema, value, path, errors);
  if (typeof value === "number") checkNumber(schema, value, path, errors);
  if (Array.isArray(value)) checkArray(schema, value, path, errors);
}

function checkType(
  schema: ConfigurationPropertySchema,
  value: unknown,
  path: string,
  errors: Array<{ path: string; message: string }>,
): boolean {
  // If schema has no type constraint (e.g. oneOf/anyOf composition), skip type check
  if (schema.type === undefined) return true;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const actual = getJsonType(value);
  if (actual === "integer" && types.includes("number")) return true;
  if (!types.includes(actual as (typeof types)[number])) {
    // SAFETY: checking membership validates the narrowing
    errors.push({
      path,
      message: `Expected ${types.join("|")}, got ${actual}`,
    });
    return false;
  }
  return true;
}

function getJsonType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  return typeof value;
}

function checkEnum(
  schema: ConfigurationPropertySchema,
  value: unknown,
  path: string,
  errors: Array<{ path: string; message: string }>,
): void {
  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    errors.push({
      path,
      message: `Value not in enum: [${schema.enum.join(", ")}]`,
    });
  }
}

function checkConst(
  schema: ConfigurationPropertySchema,
  value: unknown,
  path: string,
  errors: Array<{ path: string; message: string }>,
): void {
  if ("const" in schema && value !== schema.const) {
    errors.push({ path, message: `Expected const ${String(schema.const)}` });
  }
}

function checkString(
  schema: ConfigurationPropertySchema,
  value: string,
  path: string,
  errors: Array<{ path: string; message: string }>,
): void {
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push({
      path,
      message: `String length ${value.length} < minLength ${schema.minLength}`,
    });
  }
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    errors.push({
      path,
      message: `String length ${value.length} > maxLength ${schema.maxLength}`,
    });
  }
  if (schema.pattern !== undefined) {
    if (!isSafePattern(schema.pattern)) {
      errors.push({
        path,
        message: `Pattern rejected as potentially unsafe: ${schema.pattern}`,
      });
    } else if (!getCachedRegex(schema.pattern).test(value)) {
      errors.push({
        path,
        message: `String does not match pattern ${schema.pattern}`,
      });
    }
  }
}

function checkNumber(
  schema: ConfigurationPropertySchema,
  value: number,
  path: string,
  errors: Array<{ path: string; message: string }>,
): void {
  if (schema.minimum !== undefined && value < schema.minimum) {
    errors.push({ path, message: `${value} < minimum ${schema.minimum}` });
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    errors.push({ path, message: `${value} > maximum ${schema.maximum}` });
  }
  if (
    schema.exclusiveMinimum !== undefined &&
    value <= schema.exclusiveMinimum
  ) {
    errors.push({
      path,
      message: `${value} <= exclusiveMinimum ${schema.exclusiveMinimum}`,
    });
  }
  if (
    schema.exclusiveMaximum !== undefined &&
    value >= schema.exclusiveMaximum
  ) {
    errors.push({
      path,
      message: `${value} >= exclusiveMaximum ${schema.exclusiveMaximum}`,
    });
  }
  if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
    errors.push({
      path,
      message: `${value} is not a multiple of ${schema.multipleOf}`,
    });
  }
}

function checkArray(
  schema: ConfigurationPropertySchema,
  value: unknown[],
  path: string,
  errors: Array<{ path: string; message: string }>,
): void {
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    errors.push({
      path,
      message: `Array length ${value.length} < minItems ${schema.minItems}`,
    });
  }
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    errors.push({
      path,
      message: `Array length ${value.length} > maxItems ${schema.maxItems}`,
    });
  }
  if (
    schema.uniqueItems &&
    new Set(value.map((v) => JSON.stringify(v))).size !== value.length
  ) {
    errors.push({ path, message: "Array items are not unique" });
  }
}
