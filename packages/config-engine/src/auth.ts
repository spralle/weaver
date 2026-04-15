// Authorization check functions for configuration access control

import type {
  ConfigurationAccessContext,
  ConfigurationLayer,
  ConfigurationPropertySchema,
  ConfigurationVisibility,
  ConfigurationRole,
} from "@weaver/config-types";

import { DEFAULT_LAYER_WRITE_POLICIES } from "@weaver/config-types";

const LAYER_RANK: Record<string, number> = {
  core: 0,
  app: 1,
  module: 2,
  integrator: 3,
  tenant: 4,
  user: 5,
  device: 6,
  session: 7,
};

function getLayerRank(layer: string): number {
  const rank = LAYER_RANK[layer];
  if (rank !== undefined) {
    return rank;
  }
  // Dynamic scope layers sit between tenant (4) and user (5)
  return 4.5;
}

const ADMIN_ROLES: ReadonlySet<ConfigurationRole> = new Set([
  "tenant-admin",
  "platform-ops",
  "support",
]);

const PLATFORM_ROLES: ReadonlySet<ConfigurationRole> = new Set([
  "platform-ops",
]);

function hasAnyRole(
  roles: ReadonlyArray<ConfigurationRole>,
  allowedRoles: ReadonlySet<ConfigurationRole>,
): boolean {
  return roles.some((r) => allowedRoles.has(r));
}

/**
 * Checks whether the caller can read a given configuration key.
 *
 * - public → always readable
 * - admin → requires tenant-admin, platform-ops, or support
 * - platform → requires platform-ops
 * - internal → never readable via API
 */
export function canRead(
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
      return hasAnyRole(accessContext.roles, ADMIN_ROLES);
    case "platform":
      return hasAnyRole(accessContext.roles, PLATFORM_ROLES);
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
 * 4. Session-layer sessionMode: if writing to "session" layer,
 *    "blocked" → always deny, "restricted" → require god-mode session elevation
 */
export function canWrite(
  accessContext: ConfigurationAccessContext,
  layer: ConfigurationLayer | string,
  _key: string,
  propertySchema: ConfigurationPropertySchema | undefined,
): boolean {
  // Check layer write policy
  const policy = DEFAULT_LAYER_WRITE_POLICIES.find((p) => p.layer === layer);
  if (policy) {
    const callerHasLayerRole = accessContext.roles.some((r) =>
      policy.allowedRoles.includes(r),
    );
    if (!callerHasLayerRole) {
      return false;
    }
  } else {
    // Dynamic scope layer — allow scope-admin, tenant-admin, platform-ops
    const dynamicScopeAllowed: ReadonlySet<ConfigurationRole> = new Set([
      "scope-admin",
      "tenant-admin",
      "platform-ops",
    ]);
    if (!hasAnyRole(accessContext.roles, dynamicScopeAllowed)) {
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
      propertySchema.writeRestriction!.includes(r),
    );
    if (!callerHasKeyRole) {
      return false;
    }
  }

  // Check maxOverrideLayer ceiling
  if (propertySchema.maxOverrideLayer !== undefined) {
    const ceilingRank = getLayerRank(propertySchema.maxOverrideLayer);
    const targetRank = getLayerRank(layer);
    if (targetRank > ceilingRank) {
      // Deny unless emergency override
      return accessContext.sessionMode === "emergency-override";
    }
  }

  // Check sessionMode enforcement for SESSION layer writes
  if (layer === "session") {
    const propertySessionMode = propertySchema.sessionMode ?? "allowed";
    if (propertySessionMode === "blocked") {
      return false;
    }
    if (propertySessionMode === "restricted") {
      return accessContext.sessionMode === "god-mode";
    }
  }

  return true;
}

/**
 * Filters an entries record to include only keys the caller can read.
 */
export function filterVisibleKeys(
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
