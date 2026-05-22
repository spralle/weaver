// schema-diff.ts — Pure utility functions for schema comparison and conflict detection

import type { ConfigurationPropertySchema } from "@weaver-conf/config-types";
import { deepEqual } from "./deep-equal.js";

/**
 * Extracts property names from a schema object.
 * Handles both `{ properties: { ... } }` wrapper format and flat key-value format.
 */
export function getSchemaProperties(
  schema: ConfigurationPropertySchema,
): Set<string> {
  if (schema.properties) {
    return new Set(Object.keys(schema.properties));
  }
  return new Set(Object.keys(schema));
}

/**
 * Extracts the declared type of a property within a schema object.
 * Returns undefined if the type cannot be determined.
 */
export function getSchemaPropertyType(
  schema: ConfigurationPropertySchema,
  prop: string,
): string | undefined {
  if (schema.properties) {
    const propDef = schema.properties[prop];
    if (propDef) {
      const { type } = propDef;
      if (typeof type === "string") {
        return type;
      }
    }
    return undefined;
  }
  return undefined;
}

/**
 * Compares two schemas for structural equality.
 */
export function schemasEqual(a: unknown, b: unknown): boolean {
  return deepEqual(a, b);
}

export interface BreakingChange {
  type: "removed-property" | "type-changed";
  property: string;
  message: string;
}

/**
 * Detects breaking changes between an existing schema and an incoming schema.
 * Breaking changes include removed properties and type changes on existing properties.
 */
export function detectBreakingChanges(
  existing: ConfigurationPropertySchema,
  incoming: ConfigurationPropertySchema,
): BreakingChange[] {
  const changes: BreakingChange[] = [];

  const existingProps = getSchemaProperties(existing);
  const incomingProps = getSchemaProperties(incoming);

  for (const prop of existingProps) {
    if (!incomingProps.has(prop)) {
      changes.push({
        type: "removed-property",
        property: prop,
        message: `Removed property: ${prop}`,
      });
    }
  }

  for (const prop of existingProps) {
    if (incomingProps.has(prop)) {
      const existingType = getSchemaPropertyType(existing, prop);
      const incomingType = getSchemaPropertyType(incoming, prop);
      if (existingType && incomingType && existingType !== incomingType) {
        changes.push({
          type: "type-changed",
          property: prop,
          message: `Type changed for "${prop}": ${existingType} → ${incomingType}`,
        });
      }
    }
  }

  return changes;
}

/**
 * Returns the set of property keys that were removed between two schemas.
 */
export function diffSchemaKeys(
  existing: ConfigurationPropertySchema,
  incoming: ConfigurationPropertySchema,
): { added: Set<string>; removed: Set<string> } {
  const existingProps = getSchemaProperties(existing);
  const incomingProps = getSchemaProperties(incoming);

  const added = new Set<string>();
  const removed = new Set<string>();

  for (const prop of incomingProps) {
    if (!existingProps.has(prop)) {
      added.add(prop);
    }
  }

  for (const prop of existingProps) {
    if (!incomingProps.has(prop)) {
      removed.add(prop);
    }
  }

  return { added, removed };
}
