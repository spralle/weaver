import type { ZodRawShape } from "zod";
import type { NamespaceDefinition } from "./namespace";
import type { WeaverTransport } from "./transport";

/** Result of registering namespace schemas with the server. */
export interface SchemaRegistrationResult {
  registered: string[];
  skipped: string[];
  errors: Array<{ namespace: string; error: string }>;
}

/**
 * Convert a Zod schema shape to a simplified JSON Schema representation.
 * Handles common types via duck-typing on Zod 4 internals.
 */
export function zodShapeToJsonSchema(
  shape: ZodRawShape,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const { jsonType, isOptional } = inferZodType(fieldSchema);
    properties[key] = jsonType;
    if (!isOptional) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function inferZodType(schema: unknown): {
  jsonType: Record<string, unknown>;
  isOptional: boolean;
} {
  // SAFETY: duck-typing Zod internals — schema is an opaque Zod type object
  const s = schema as Record<string, unknown>;
  let isOptional = false;
  let current = s;

  // Unwrap optional/nullable wrappers
  const def = getZodDef(current);
  if (def && (def.type === "optional" || def.type === "nullable")) {
    isOptional = true;
    const inner = def.innerType;
    if (inner) current = inner as Record<string, unknown>; // SAFETY: Zod innerType is a schema object
  }

  const innerDef = getZodDef(current);
  const typeName = innerDef?.type as string | undefined; // SAFETY: Zod def.type is always string if present

  if (typeName === "string")
    return { jsonType: { type: "string" }, isOptional };
  if (typeName === "number" || typeName === "float")
    return { jsonType: { type: "number" }, isOptional };
  if (typeName === "int") return { jsonType: { type: "integer" }, isOptional };
  if (typeName === "boolean")
    return { jsonType: { type: "boolean" }, isOptional };
  if (typeName === "array") return { jsonType: { type: "array" }, isOptional };
  if (typeName === "object") {
    const shape = innerDef?.shape;
    if (shape && typeof shape === "object") {
      return {
        jsonType: zodShapeToJsonSchema(shape as ZodRawShape),
        isOptional,
      }; // SAFETY: confirmed shape is object
    }
    return { jsonType: { type: "object" }, isOptional };
  }
  if (typeName === "enum") {
    const entries = innerDef?.entries;
    if (entries && typeof entries === "object") {
      return {
        jsonType: { type: "string", enum: Object.keys(entries as object) },
        isOptional,
      }; // SAFETY: entries confirmed as object
    }
    return { jsonType: { type: "string" }, isOptional };
  }
  if (typeName === "literal") {
    const value = innerDef?.value;
    return { jsonType: { type: typeof value, const: value }, isOptional };
  }

  // Fallback
  return { jsonType: {}, isOptional };
}

function getZodDef(
  schema: Record<string, unknown>,
): Record<string, unknown> | undefined {
  // SAFETY: accessing Zod 4 internal structure
  const _zod = schema._zod as Record<string, unknown> | undefined;
  if (_zod?.def) return _zod.def as Record<string, unknown>; // SAFETY: Zod def is always an object
  // Zod 3 fallback: schema._def
  const _def = schema._def as Record<string, unknown> | undefined; // SAFETY: Zod 3 internal structure
  if (_def?.type) return _def;
  return undefined;
}

export async function registerNamespaces(
  definitions: ReadonlyArray<NamespaceDefinition>,
  transport: WeaverTransport,
): Promise<SchemaRegistrationResult> {
  const result: SchemaRegistrationResult = {
    registered: [],
    skipped: [],
    errors: [],
  };

  if (!transport.registerSchema) {
    result.skipped = definitions.map((d) => d.prefix);
    return result;
  }

  for (const def of definitions) {
    try {
      const jsonSchema = zodShapeToJsonSchema(def.schema.shape);
      await transport.registerSchema(def.prefix, jsonSchema);
      result.registered.push(def.prefix);
    } catch (e) {
      result.errors.push({
        namespace: def.prefix,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}
