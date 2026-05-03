import type { ScopeInstance } from "@weaver/config-types";

export interface ConfigDelta {
  action: "set" | "remove";
  key: string;
  value: unknown | null;
  layer: string;
  environment: string;
  timestamp: string;
}

export interface ConfigSnapshot {
  entries: Record<string, unknown>;
  scopes: Record<string, Record<string, unknown>>;
  revision: string;
  timestamp?: string;
}

export interface ResolveOptions {
  scopePath?: ScopeInstance[];
  environment?: string;
}

export interface GetOptions {
  scopePath?: ScopeInstance[];
}

export interface ConfigurationInspection<T> {
  key: string;
  effectiveValue: T | undefined;
  layers: Array<{ layer: string; value: T | undefined; environment?: string }>;
}

export type Unsubscribe = () => void;
