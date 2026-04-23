import type {
  DynamicLayerConfig,
  EphemeralLayerConfig,
  LayerDefinition,
  LayerResolver,
  LayerType,
  PersonalLayerConfig,
  StaticLayerConfig,
} from "./layers.js";
import type { MergeFunction } from "./merge-types.js";
import type { ConfigurationStorageProvider } from "./providers.js";

// --- Default merge: deep merge ---
// The real deepMerge lives in config-engine, but we need a default reference.
// This is a simple recursive deep merge: null clears, objects merge, arrays replace.
const defaultMerge: MergeFunction = (
  base: unknown,
  override: unknown,
): unknown => {
  if (override === null) return undefined;
  if (override === undefined) return base;
  if (
    typeof base === "object" &&
    base !== null &&
    typeof override === "object" &&
    override !== null &&
    !Array.isArray(base) &&
    !Array.isArray(override)
  ) {
    const result: Record<string, unknown> = {
      ...(base as Record<string, unknown>),
    };
    for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
      result[k] = defaultMerge(result[k], v);
    }
    return result;
  }
  return override;
};

/** Replace-only merge: no deep merging, later layer wins completely */
export const replaceOnly: MergeFunction = (
  _base: unknown,
  override: unknown,
): unknown => override;

// --- Built-in LayerType implementations ---

const staticType: LayerType = {
  id: "static",
  persistent: true,
  defaultMerge,
  createResolver(
    _provider: ConfigurationStorageProvider,
    _config: unknown,
  ): LayerResolver {
    return {
      resolve: () => [],
    };
  },
};

const dynamicType: LayerType = {
  id: "dynamic",
  persistent: true,
  defaultMerge,
  createResolver(
    _provider: ConfigurationStorageProvider,
    _config: unknown,
  ): LayerResolver {
    return {
      resolve: () => [],
    };
  },
};

const personalType: LayerType = {
  id: "personal",
  persistent: true,
  defaultMerge,
  createResolver(
    _provider: ConfigurationStorageProvider,
    _config: unknown,
  ): LayerResolver {
    return {
      resolve: () => [],
    };
  },
};

const ephemeralType: LayerType = {
  id: "ephemeral",
  persistent: false,
  defaultMerge,
  createResolver(
    _provider: ConfigurationStorageProvider,
    _config: unknown,
  ): LayerResolver {
    return {
      resolve: () => [],
    };
  },
};

// --- Factory functions ---

function Static<N extends string>(
  name: N,
  config?: StaticLayerConfig,
): LayerDefinition<N> {
  return { name, type: staticType, config: config ?? {} };
}

function Dynamic<N extends string>(
  name: N,
  config?: DynamicLayerConfig,
): LayerDefinition<N> {
  return { name, type: dynamicType, config: config ?? {} };
}

function Personal<N extends string>(
  name: N,
  config?: PersonalLayerConfig,
): LayerDefinition<N> {
  return { name, type: personalType, config: config ?? {} };
}

function Ephemeral<N extends string>(
  name: N,
  config?: EphemeralLayerConfig,
): LayerDefinition<N> {
  return { name, type: ephemeralType, config: config ?? {} };
}

/** Built-in layer factories */
export const Layers = {
  Static,
  Dynamic,
  Personal,
  Ephemeral,
} as const;
