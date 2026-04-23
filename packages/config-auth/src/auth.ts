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

  /**
   * Checks whether the caller can write to a given configuration key at a specific layer.
   *
   * Checks:
   * 1. Layer write policy: caller's role must be in the layer's allowedRoles
   * 2. Key writeRestriction: if schema has writeRestriction, caller's role must be in it
   * 3. maxOverrideLayer: if schema has maxOverrideLayer and target layer is above it,
   *    deny UNLESS sessionMode === "emergency-override"
   * 4. Session-layer sessionMode: if writing to the configured session layer,
   *    "blocked" -> always deny, "restricted" -> require elevated session mode
   */
  function canWrite(
    accessContext: ConfigurationAccessContext,
    layer: string,
    _key: string,
    propertySchema: ConfigurationPropertySchema | undefined,
  ): boolean {
    // Check layer write policy
    const policy = layerWritePolicies.find((p) => p.layer === layer);
    if (policy) {
      const callerHasLayerRole = accessContext.roles.some((r) =>
        policy.allowedRoles.includes(r),
      );
      if (!callerHasLayerRole) {
        return false;
      }
    } else {
      // Unknown layer (dynamic scope) — use dynamicScopeRoles
      if (!hasAnyRole(accessContext.roles, dynamicScopeRoles)) {
        return false;
      }
    }

    if (!propertySchema) {
      return true;
    }

    // Check key-level writeRestriction
    if (
      propertySchema.writeRestriction !== undefined &&
      propertySchema.writeRestriction.length > 0
    ) {
      const callerHasKeyRole = accessContext.roles.some((r) =>
        propertySchema.writeRestriction?.includes(r),
      );
      if (!callerHasKeyRole) {
        return false;
      }
    }

    // Check maxOverrideLayer ceiling
    if (propertySchema.maxOverrideLayer !== undefined) {
      const ceilingRank = getRank(propertySchema.maxOverrideLayer);
      const targetRank = getRank(layer);
      if (ceilingRank >= 0 && targetRank >= 0 && targetRank > ceilingRank) {
        // Deny unless emergency override
        return accessContext.sessionMode === "emergency-override";
      }
    }

    // Check sessionMode enforcement for session layer writes
    if (sessionLayer !== undefined && layer === sessionLayer) {
      const propertySessionMode = propertySchema.sessionMode ?? "allowed";
      if (propertySessionMode === "blocked") {
        return false;
      }
      if (propertySessionMode === "restricted") {
        return (
          accessContext.sessionMode === (elevatedSessionMode ?? "god-mode")
        );
      }
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
