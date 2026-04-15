export type ConfigurationLayer = string;

export interface ScopeDefinition {
  id: string;
  label: string;
  parentScopeId?: string | undefined;
}

export interface ScopeInstance {
  scopeId: string;
  value: string;
}

export interface TenantScopeHierarchy {
  scopes: ScopeDefinition[];
}

export interface ConfigurationContext {
  tenantId: string;
  scopePath: ScopeInstance[];
  userId: string;
  deviceId: string;
}

export interface ConfigurationLayerEntry {
  layer: ConfigurationLayer | string;
  entries: Record<string, unknown>;
}

export interface ConfigurationLayerStack {
  layers: ConfigurationLayerEntry[];
}

export interface ConfigurationLayerData {
  entries: Record<string, unknown>;
  revision?: string | undefined;
  lastSyncedAt?: number | undefined;
}
