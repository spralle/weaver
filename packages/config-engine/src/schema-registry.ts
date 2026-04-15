// Schema registry — aggregation and collision detection

import type { ConfigurationPropertySchema } from "@weaver/config-types";

import { qualifyKey, validateKeyFormat } from "./namespace.js";

export interface ConfigurationSchemaDeclaration {
  ownerId: string;
  namespace: string;
  properties: Record<string, ConfigurationPropertySchema>;
}

export interface ComposedSchemaEntry {
  ownerId: string;
  fullyQualifiedKey: string;
  schema: ConfigurationPropertySchema;
}

export interface SchemaCompositionError {
  type: "duplicate-key" | "invalid-key-format";
  key: string;
  message: string;
  ownerIds?: string[] | undefined;
}

export interface ComposeResult {
  schemas: Map<string, ComposedSchemaEntry>;
  errors: SchemaCompositionError[];
}

export interface RegisterSchemaResult {
  registeredKeys: string[];
  errors: SchemaCompositionError[];
}

export interface UnregisterSchemaResult {
  removedKeys: string[];
}

export interface ConfigurationSchemaRegistry {
  register(declaration: ConfigurationSchemaDeclaration): RegisterSchemaResult;
  unregister(ownerId: string): UnregisterSchemaResult;
  getSchema(fullyQualifiedKey: string): ComposedSchemaEntry | undefined;
  getSchemas(): Map<string, ComposedSchemaEntry>;
  getSchemasByOwner(ownerId: string): Map<string, ComposedSchemaEntry>;
  getCompositionErrors(): SchemaCompositionError[];
}

class IncrementalConfigurationSchemaRegistry
  implements ConfigurationSchemaRegistry
{
  private readonly schemas = new Map<string, ComposedSchemaEntry>();

  private readonly keyOwners = new Map<string, string[]>();

  private readonly ownerEntries = new Map<string, Map<string, ComposedSchemaEntry>>();

  private readonly ownerIndex = new Map<string, Set<string>>();

  register(declaration: ConfigurationSchemaDeclaration): RegisterSchemaResult {
    this.unregister(declaration.ownerId);

    const errors: SchemaCompositionError[] = [];
    const touchedKeys = new Set<string>();
    const registeredKeys: string[] = [];

    for (const relativeKey of Object.keys(declaration.properties)) {
      const fullyQualifiedKey = qualifyKey(declaration.namespace, relativeKey);
      const validation = validateKeyFormat(fullyQualifiedKey);

      if (!validation.valid) {
        errors.push({
          type: "invalid-key-format",
          key: fullyQualifiedKey,
          message: validation.error ?? `Invalid key format: ${fullyQualifiedKey}`,
        });
        continue;
      }

      const schema = declaration.properties[relativeKey];
      if (schema === undefined) {
        continue;
      }

      const entry: ComposedSchemaEntry = {
        ownerId: declaration.ownerId,
        fullyQualifiedKey,
        schema,
      };

      this.addOwnerEntry(entry);
      touchedKeys.add(fullyQualifiedKey);

      if (!this.schemas.has(fullyQualifiedKey)) {
        this.schemas.set(fullyQualifiedKey, entry);
        registeredKeys.push(fullyQualifiedKey);
      }
    }

    for (const fullyQualifiedKey of touchedKeys) {
      const owners = this.keyOwners.get(fullyQualifiedKey) ?? [];
      if (owners.length > 1) {
        errors.push({
          type: "duplicate-key",
          key: fullyQualifiedKey,
          message: `Duplicate configuration key "${fullyQualifiedKey}" declared by: ${owners.join(", ")}`,
          ownerIds: [...owners],
        });
      }
    }

    return { registeredKeys, errors };
  }

  unregister(ownerId: string): UnregisterSchemaResult {
    const ownedKeys = this.ownerIndex.get(ownerId);
    if (ownedKeys === undefined) {
      return { removedKeys: [] };
    }

    const removedKeys: string[] = [];

    for (const fullyQualifiedKey of ownedKeys) {
      this.removeOwnerFromKey(fullyQualifiedKey, ownerId);

      const currentEntry = this.schemas.get(fullyQualifiedKey);
      if (currentEntry?.ownerId !== ownerId) {
        continue;
      }

      const nextOwnerId = (this.keyOwners.get(fullyQualifiedKey) ?? [])[0];
      if (nextOwnerId === undefined) {
        this.schemas.delete(fullyQualifiedKey);
        removedKeys.push(fullyQualifiedKey);
        continue;
      }

      const nextEntry = this.ownerEntries.get(nextOwnerId)?.get(fullyQualifiedKey);
      if (nextEntry === undefined) {
        this.schemas.delete(fullyQualifiedKey);
        removedKeys.push(fullyQualifiedKey);
      } else {
        this.schemas.set(fullyQualifiedKey, nextEntry);
      }
    }

    this.ownerEntries.delete(ownerId);
    this.ownerIndex.delete(ownerId);

    return { removedKeys };
  }

  getSchema(fullyQualifiedKey: string): ComposedSchemaEntry | undefined {
    return this.schemas.get(fullyQualifiedKey);
  }

  getSchemas(): Map<string, ComposedSchemaEntry> {
    return new Map(this.schemas);
  }

  getSchemasByOwner(ownerId: string): Map<string, ComposedSchemaEntry> {
    return new Map(this.ownerEntries.get(ownerId) ?? new Map());
  }

  getCompositionErrors(): SchemaCompositionError[] {
    const errors: SchemaCompositionError[] = [];

    for (const [fullyQualifiedKey, owners] of this.keyOwners) {
      if (owners.length < 2) {
        continue;
      }

      errors.push({
        type: "duplicate-key",
        key: fullyQualifiedKey,
        message: `Duplicate configuration key "${fullyQualifiedKey}" declared by: ${owners.join(", ")}`,
        ownerIds: [...owners],
      });
    }

    return errors;
  }

  private addOwnerEntry(entry: ComposedSchemaEntry): void {
    const ownerMap = this.ownerEntries.get(entry.ownerId);
    if (ownerMap === undefined) {
      this.ownerEntries.set(entry.ownerId, new Map([[entry.fullyQualifiedKey, entry]]));
    } else {
      ownerMap.set(entry.fullyQualifiedKey, entry);
    }

    const ownerKeys = this.ownerIndex.get(entry.ownerId);
    if (ownerKeys === undefined) {
      this.ownerIndex.set(entry.ownerId, new Set([entry.fullyQualifiedKey]));
    } else {
      ownerKeys.add(entry.fullyQualifiedKey);
    }

    const owners = this.keyOwners.get(entry.fullyQualifiedKey);
    if (owners === undefined) {
      this.keyOwners.set(entry.fullyQualifiedKey, [entry.ownerId]);
      return;
    }

    owners.push(entry.ownerId);
  }

  private removeOwnerFromKey(fullyQualifiedKey: string, ownerId: string): void {
    const owners = this.keyOwners.get(fullyQualifiedKey);
    if (owners === undefined) {
      return;
    }

    const filteredOwners = owners.filter((value) => value !== ownerId);
    if (filteredOwners.length === 0) {
      this.keyOwners.delete(fullyQualifiedKey);
      return;
    }

    this.keyOwners.set(fullyQualifiedKey, filteredOwners);
  }
}

export function createSchemaRegistry(): ConfigurationSchemaRegistry {
  return new IncrementalConfigurationSchemaRegistry();
}

/**
 * Composes configuration schemas from multiple declarations into a unified map.
 *
 * For each declaration, qualifies each relative key with the namespace,
 * validates key format, and detects duplicate fully-qualified keys.
 */
export function composeConfigurationSchemas(
  declarations: ConfigurationSchemaDeclaration[],
): ComposeResult {
  const schemas = new Map<string, ComposedSchemaEntry>();
  const errors: SchemaCompositionError[] = [];

  // Track owners per key for duplicate detection
  const keyOwners = new Map<string, string[]>();

  for (const declaration of declarations) {
    for (const relativeKey of Object.keys(declaration.properties)) {
      const fqKey = qualifyKey(declaration.namespace, relativeKey);

      // Validate key format
      const validation = validateKeyFormat(fqKey);
      if (!validation.valid) {
        errors.push({
          type: "invalid-key-format",
          key: fqKey,
          message: validation.error ?? `Invalid key format: ${fqKey}`,
        });
        continue;
      }

      // Track owners for duplicate detection
      const owners = keyOwners.get(fqKey);
      if (owners !== undefined) {
        owners.push(declaration.ownerId);
      } else {
        keyOwners.set(fqKey, [declaration.ownerId]);
      }

      // Only store the first declaration for each key
      if (!schemas.has(fqKey)) {
        const schema = declaration.properties[relativeKey];
        if (schema === undefined) {
          continue;
        }
        schemas.set(fqKey, {
          ownerId: declaration.ownerId,
          fullyQualifiedKey: fqKey,
          schema,
        });
      }
    }
  }

  // Report duplicates
  for (const [key, owners] of keyOwners) {
    if (owners.length > 1) {
      errors.push({
        type: "duplicate-key",
        key,
        message: `Duplicate configuration key "${key}" declared by: ${owners.join(", ")}`,
        ownerIds: owners,
      });
    }
  }

  return { schemas, errors };
}
