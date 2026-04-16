// Authorization check functions for configuration access control
// Genericized via withAuth() composition — no hardcoded roles

import type {
  ConfigurationAccessContext,
  ConfigurationPropertySchema,
  ConfigurationVisibility,
  LayerWritePolicy,
  WeaverConfig,
} from "@weaver/config-types";

/** Maps visibility levels to role sets that can read */
export interface VisibilityRoleMapping {
  admin: ReadonlySet<string>;
  platform: ReadonlySet<string>;
}

export interface AuthConfig {
  /** WeaverConfig for layer ranking */
  weaverConfig: WeaverConfig;
  /** Role sets for visibility checks (admin -> which roles, platform -> which roles) */
  visibilityRoles: VisibilityRoleMapping;
  /** Layer write policies — which roles can write to which layers */
  layerWritePolicies: ReadonlyArray<LayerWritePolicy>;
  /** Roles allowed for dynamic scope layer writes (layers not in write policies) */
  dynamicScopeRoles: ReadonlySet<string>;
  /** Name of the session/ephemeral layer for session-mode enforcement */
  sessionLayer?: string | undefined;
  /** Session mode value that grants elevated access for "restricted" properties */
  elevatedSessionMode?: string | undefined;
}

export interface AuthFunctions {
  canRead(
    accessContext: ConfigurationAccessContext,
    key: string,
    propertySchema: ConfigurationPropertySchema | undefined,
  ): boolean;

  canWrite(
    accessContext: ConfigurationAccessContext,
    layer: string,
    key: string,
    propertySchema: ConfigurationPropertySchema | undefined,
  ): boolean;

  filterVisibleKeys(
    accessContext: ConfigurationAccessContext,
    entries: Record<string, unknown>,
    schemaMap: Map<string, ConfigurationPropertySchema>,
  ): Record<string, unknown>;
}

export function withAuth(config: AuthConfig): AuthFunctions {
  const {
    weaverConfig,
    visibilityRoles,
    layerWritePolicies,
    dynamicScopeRoles,
    sessionLayer,
    elevatedSessionMode,
  } = config;

  function getRank(layer: string): number {
    return weaverConfig.getRank(layer);
  }

  function hasAnyRole(
    roles: ReadonlyArray<string>,
    allowedRoles: ReadonlySet<string>,
  ): boolean {
    return roles.some((r) => allowedRoles.has(r));
  }

  /**
   * Checks whether the caller can read a given configuration key.
   *
   * - public -> always readable
   * - admin -> requires roles in visibilityRoles.admin
   * - platform -> requires roles in visibilityRoles.platform
   * - internal -> never readable via API
   */
  function canRead(
    accessContext: ConfigurationAccessContext,
    _key: string,
    propertySchema: ConfigurationPropertySchema | undefined,
  ): boolean {
    if (!propertySchema) {
      return true;
    }

    const visibility: ConfigurationVisibility =
      propertySchema.visibility ?? "public";

    switch (visibility) {
      case "public":
        return true;
      case "admin":
        return hasAnyRole(accessContext.roles, visibilityRoles.admin);
      case "platform":
        return hasAnyRole(accessContext.roles, visibilityRoles.platform);
      case "internal":
        return false;
    }
  }

  /** Checks if the caller's roles satisfy the layer write policy or dynamic scope fallback. */
  function checkLayerWritePolicy(roles: ReadonlyArray<string>, layer: string): boolean {
    const policy = layerWritePolicies.find((p) => p.layer === layer);
    if (policy) {
      return roles.some((r) => policy.allowedRoles.includes(r));
    }
    // Unknown layer (dynamic scope) — use dynamicScopeRoles
    return hasAnyRole(roles, dynamicScopeRoles);
  }

  /** Checks key-level writeRestriction against caller roles. */
  function checkWriteRestriction(
    roles: ReadonlyArray<string>,
    schema: ConfigurationPropertySchema,
  ): boolean {
    if (schema.writeRestriction === undefined || schema.writeRestriction.length === 0) {
      return true;
    }
    return roles.some((r) => schema.writeRestriction!.includes(r));
  }

  /** Checks maxOverrideLayer ceiling — denies if target layer exceeds ceiling (unless emergency). */
  function checkMaxOverrideLayer(
    layer: string,
    schema: ConfigurationPropertySchema,
    sessionMode: string | undefined,
  ): boolean {
    if (schema.maxOverrideLayer === undefined) {
      return true;
    }
    const ceilingRank = getRank(schema.maxOverrideLayer);
    const targetRank = getRank(layer);
    if (ceilingRank >= 0 && targetRank >= 0 && targetRank > ceilingRank) {
      return sessionMode === "emergency-override";
    }
    return true;
  }

  /** Enforces sessionMode rules when writing to the session layer. */
  function checkSessionModeEnforcement(
    layer: string,
    schema: ConfigurationPropertySchema,
    sessionMode: string | undefined,
  ): boolean {
    if (sessionLayer === undefined || layer !== sessionLayer) {
      return true;
    }
    const propertySessionMode = schema.sessionMode ?? "allowed";
    if (propertySessionMode === "blocked") {
      return false;
    }
    if (propertySessionMode === "restricted") {
      return sessionMode === (elevatedSessionMode ?? "god-mode");
    }
    return true;
  }

  /**
   * Checks whether the caller can write to a given configuration key at a specific layer.
   */
  function canWrite(
    accessContext: ConfigurationAccessContext,
    layer: string,
    _key: string,
    propertySchema: ConfigurationPropertySchema | undefined,
  ): boolean {
    if (!checkLayerWritePolicy(accessContext.roles, layer)) {
      return false;
    }
    if (!propertySchema) {
      return true;
    }
    if (!checkWriteRestriction(accessContext.roles, propertySchema)) {
      return false;
    }
    if (!checkMaxOverrideLayer(layer, propertySchema, accessContext.sessionMode)) {
      return false;
    }
    if (!checkSessionModeEnforcement(layer, propertySchema, accessContext.sessionMode)) {
      return false;
    }
    return true;
  }

  /**
   * Filters an entries record to include only keys the caller can read.
   */
  function filterVisibleKeys(
    accessContext: ConfigurationAccessContext,
    entries: Record<string, unknown>,
    schemaMap: Map<string, ConfigurationPropertySchema>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(entries)) {
      const schema = schemaMap.get(key);
      if (canRead(accessContext, key, schema)) {
        result[key] = entries[key];
      }
    }

    return result;
  }

  return { canRead, canWrite, filterVisibleKeys };
}
