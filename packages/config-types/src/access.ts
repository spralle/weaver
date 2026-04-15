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

export interface ServiceConfigurationDeclaration {
  serviceId: string;
  description: string;
  configuration: {
    properties: Record<string, import("./property-schema.js").ConfigurationPropertySchema>;
  };
  reads?: ReadonlyArray<string> | undefined;
}
