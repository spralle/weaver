// schema-diff.ts — Pure utility functions for schema comparison and conflict detection

/**
 * Extracts property names from a schema object.
 * Handles both `{ properties: { ... } }` wrapper format and flat key-value format.
 */
export function getSchemaProperties(
  schema: Record<string, unknown>,
): Set<string> {
  const properties = (schema as { properties?: Record<string, unknown> })
    .properties;
  if (typeof properties === "object" && properties !== null) {
    return new Set(Object.keys(properties));
  }
  return new Set(Object.keys(schema));
}

/**
 * Extracts the declared type of a property within a schema object.
 * Returns undefined if the type cannot be determined.
 */
export function getSchemaPropertyType(
  schema: Record<string, unknown>,
  prop: string,
): string | undefined {
  const properties = (schema as { properties?: Record<string, unknown> })
    .properties;
  if (typeof properties === "object" && properties !== null) {
    const propDef = properties[prop] as Record<string, unknown> | undefined;
    if (typeof propDef?.type === "string") {
      return propDef.type;
    }
    return undefined;
  }
  const value = schema[prop];
  if (typeof value === "object" && value !== null && "type" in value) {
    const schemaType = (value as Record<string, unknown>).type;
    if (typeof schemaType === "string") {
      return schemaType;
    }
  }
  return undefined;
}

/**
 * Compares two schemas for structural equality using JSON serialization.
 */
export function schemasEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
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
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
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
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
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
