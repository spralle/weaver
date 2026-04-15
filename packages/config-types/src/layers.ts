import type { MergeFunction } from "./merge-types.js";
import type { ConfigurationStorageProvider, ConfigurationChange } from "./providers.js";
import type { ScopeDefinition } from "./types.js";

// --- Core interfaces ---

/** Resolution context passed to layer resolvers */
export interface ResolutionContext {
  readonly tenantId?: string | undefined;
  readonly userId?: string | undefined;
  readonly deviceId?: string | undefined;
  readonly scopeInstances?: ReadonlyMap<string, string> | undefined;
  readonly [key: string]: unknown;
}

/** Data returned by a layer resolver */
export interface LayerData {
  readonly layerId: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly revision?: string | undefined;
}

/** Runtime resolver created by a LayerType */
export interface LayerResolver {
  resolve(context: ResolutionContext): LayerData[];
  onChange?(cb: (changes: ConfigurationChange[]) => void): () => void;
  dispose?(): void;
}

/** The contract for a layer type implementation */
export interface LayerType {
  readonly id: string;
  readonly persistent: boolean;
  readonly defaultMerge: MergeFunction;
  createResolver(
    provider: ConfigurationStorageProvider,
    config: unknown,
  ): LayerResolver;
}

/** A bound layer definition — name + type + config */
export interface LayerDefinition<N extends string = string> {
  readonly name: N;
  readonly type: LayerType;
  readonly config: unknown;
}

// --- Config for built-in layer types ---

export interface StaticLayerConfig {
  readonly merge?: MergeFunction | undefined;
}

export interface DynamicLayerConfig {
  readonly scopes?: readonly ScopeDefinition[] | undefined;
  readonly merge?: MergeFunction | undefined;
}

export interface PersonalLayerConfig {
  readonly merge?: MergeFunction | undefined;
}

export interface EphemeralLayerConfig {
  readonly merge?: MergeFunction | undefined;
}
