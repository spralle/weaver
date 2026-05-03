import type { ConfigurationPropertySchema, ConfigurationRole } from "./property-schema.js";
import type { SessionType } from "./session.js";
import type { ConfigurationLayer, ScopeInstance } from "./types.js";

export interface ConfigurationAccessContext {
  userId: string;
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

export interface ConfigurationSchemaFragment {
  readonly description: string;
  readonly schemaVersion: number;
  readonly owner: string;
  readonly configuration: ConfigurationPropertySchema;
}

export interface ServiceConfigurationDeclaration {
  readonly serviceId: string;
  readonly description: string;
  readonly schemaVersion: number;
  readonly owner: string;
  readonly namespaces?: ReadonlyArray<string> | undefined;
  readonly configuration: ConfigurationPropertySchema;
  readonly reads?: ReadonlyArray<string> | undefined;
  readonly fragments?: Readonly<Record<string, ConfigurationSchemaFragment>> | undefined;
  readonly instanceConfig?: {
    readonly instanceKey: string;
    readonly maxInstances?: number | undefined;
  } | undefined;
}

export interface ServiceAccessPolicy {
  readonly serviceId: string;
  readonly allowedNamespaces: ReadonlyArray<string>;
  readonly allowedReads: ReadonlyArray<string>;
  readonly allowedSecrets: boolean;
  readonly scopeAccess: "all" | ReadonlyArray<string>;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly expiresAt?: string | undefined;
}
