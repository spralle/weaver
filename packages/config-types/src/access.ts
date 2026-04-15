import type { ConfigurationLayer, ScopeInstance } from "./types.js";
import type { ConfigurationRole } from "./property-schema.js";
import type { SessionType } from "./session.js";

export interface ConfigurationAccessContext {
  userId: string;
  tenantId: string;
  roles: ReadonlyArray<ConfigurationRole>;
  assignedScopes?: ReadonlyArray<ScopeInstance> | undefined;
  sessionMode?: "emergency-override" | SessionType | undefined;
}

export interface LayerWriteConstraint {
  scopeRestriction?: "own-tenant" | "own-scope" | "own-user" | undefined;
}

export interface LayerWritePolicy {
  layer: ConfigurationLayer | string;
  allowedRoles: ReadonlyArray<ConfigurationRole>;
  constraints?: ReadonlyArray<LayerWriteConstraint> | undefined;
}

export const DEFAULT_LAYER_WRITE_POLICIES: ReadonlyArray<LayerWritePolicy> = [
  { layer: "core", allowedRoles: ["system"] },
  { layer: "app", allowedRoles: ["platform-ops", "system"] },
  { layer: "module", allowedRoles: ["system"] },
  {
    layer: "integrator",
    allowedRoles: ["platform-ops", "integrator"],
    constraints: [{ scopeRestriction: "own-tenant" }],
  },
  {
    layer: "tenant",
    allowedRoles: ["platform-ops", "tenant-admin"],
    constraints: [{ scopeRestriction: "own-tenant" }],
  },
  {
    layer: "user",
    allowedRoles: ["user", "platform-ops", "support"],
    constraints: [{ scopeRestriction: "own-user" }],
  },
  {
    layer: "device",
    allowedRoles: ["user"],
    constraints: [{ scopeRestriction: "own-user" }],
  },
  { layer: "session", allowedRoles: ["platform-ops", "support"] },
];

export interface ServiceConfigurationDeclaration {
  serviceId: string;
  description: string;
  configuration: {
    properties: Record<string, import("./property-schema.js").ConfigurationPropertySchema>;
  };
  reads?: ReadonlyArray<string> | undefined;
}
