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

export interface ScopeHierarchy {
  scopes: ScopeDefinition[];
}

/** @deprecated Use `ScopeHierarchy` instead. */
export type TenantScopeHierarchy = ScopeHierarchy;

export interface ConfigurationContext {
  scopePath: ScopeInstance[];
  userId: string;
  deviceId: string;
}

import type { MergeFunction } from "./merge-types.js";

export interface ConfigurationLayerEntry {
  layer: ConfigurationLayer | string;
  entries: Record<string, unknown>;
  merge?: MergeFunction | undefined;
}

export interface ConfigurationLayerStack {
  layers: ConfigurationLayerEntry[];
}

export interface ConfigurationLayerData {
  entries: Record<string, unknown>;
  revision?: string | undefined;
  lastSyncedAt?: number | undefined;
}
