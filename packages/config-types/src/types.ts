/** Layer identifier (opaque string, e.g., "defaults", "user", "session"). */
export type ConfigurationLayer = string;

/** Definition of a scope dimension (e.g., "region", "tenant"). */
export interface ScopeDefinition {
  id: string;
  label: string;
  parentScopeId?: string | undefined;
}

/** A concrete scope binding — dimension ID + value (e.g., { scopeId: "region", value: "eu-west" }). */
export interface ScopeInstance {
  scopeId: string;
  value: string;
}

/** Ordered list of scope definitions forming a hierarchy. */
export interface ScopeHierarchy {
  scopes: ScopeDefinition[];
}

/** @deprecated Use `ScopeHierarchy` instead. */
export type TenantScopeHierarchy = ScopeHierarchy;

/** Full context for resolving scoped configuration (scope path, user, device). */
export interface ConfigurationContext {
  scopePath: ScopeInstance[];
  userId: string;
  deviceId: string;
}

import type { MergeFunction } from "./merge-types";

/** A single layer's entries with optional custom merge function. */
export interface ConfigurationLayerEntry {
  layer: ConfigurationLayer | string;
  entries: Record<string, unknown>;
  merge?: MergeFunction | undefined;
}

/** Ordered stack of layer entries for resolution. */
export interface ConfigurationLayerStack {
  layers: ConfigurationLayerEntry[];
}

/** Raw data loaded from a storage provider — entries, revision, and sync timestamp. */
export interface ConfigurationLayerData {
  entries: Record<string, unknown>;
  revision?: string | undefined;
  lastSyncedAt?: number | undefined;
}
