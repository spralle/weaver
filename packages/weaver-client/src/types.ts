import type { ScopeInstance } from "@weaver/config-types";

export type {
  ConfigDelta,
  ConfigSnapshot,
  ConfigurationInspection,
} from "@weaver/config-types";

export interface ResolveOptions {
  scopePath?: ScopeInstance[];
  environment?: string;
}

export interface GetOptions {
  scopePath?: ScopeInstance[];
}

/**
 * Client-specific layer inspection that includes per-layer metadata (environment binding).
 * Differs from the canonical `ConfigurationInspection<T>` in config-types which uses a flat
 * `layerValues: Partial<Record<string, T>>` map. This richer structure is needed on the client
 * to display layer provenance with environment context in UI tooling.
 */
export interface ClientLayerInspection<T> {
  key: string;
  effectiveValue: T | undefined;
  layers: Array<{ layer: string; value: T | undefined; environment?: string }>;
}

export type Unsubscribe = () => void;
