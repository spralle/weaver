import type { ScopeInstance } from "@weaver/config-types";

export type { ConfigDelta, ConfigSnapshot } from "@weaver/config-types";

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
