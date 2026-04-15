// Layer resolution engine — core configuration resolution logic

import type {
  ConfigurationLayerStack,
  ConfigurationLayer,
  ConfigurationInspection,
  ConfigurationPropertySchema,
} from "@weaver/config-types";

import { deepMerge } from "./merge.js";

export interface ResolvedConfiguration {
  entries: Record<string, unknown>;
  provenance: Map<string, string>;
}

const LAYER_RANK: Record<string, number> = {
  core: 0,
  app: 1,
  module: 2,
  integrator: 3,
  tenant: 4,
  user: 5,
  device: 6,
  session: 7,
};

function getLayerRank(layer: string): number {
  const rank = LAYER_RANK[layer];
  if (rank !== undefined) {
    return rank;
  }
  // Dynamic scope layers sit between tenant (4) and user (5)
  return 4.5;
}

/**
 * Resolves a configuration layer stack by deep merging all layers in order.
 * First layer = lowest priority, last layer = highest priority.
 * Tracks provenance: for each top-level key, which layer set it last.
 */
export function resolveConfiguration(
  stack: ConfigurationLayerStack,
): ResolvedConfiguration {
  let entries: Record<string, unknown> = {};
  const provenance = new Map<string, string>();

  for (const layerEntry of stack.layers) {
    const layerKeys = Object.keys(layerEntry.entries);
    if (layerKeys.length === 0) {
      continue;
    }

    entries = deepMerge(entries, layerEntry.entries);

    for (const key of layerKeys) {
      if (layerEntry.entries[key] !== undefined) {
        provenance.set(key, layerEntry.layer);
      }
    }
  }

  return { entries, provenance };
}

const LAYER_VALUE_KEYS: Record<string, keyof ConfigurationInspection<unknown>> = {
  core: "coreValue",
  app: "appValue",
  module: "moduleValue",
  integrator: "integratorValue",
  tenant: "tenantValue",
  user: "userValue",
  device: "deviceValue",
  session: "sessionValue",
};

function setInspectionValue<T>(
  inspection: ConfigurationInspection<T>,
  key: keyof ConfigurationInspection<T>,
  value: T,
): void {
  switch (key) {
    case "coreValue":
      inspection.coreValue = value;
      break;
    case "appValue":
      inspection.appValue = value;
      break;
    case "moduleValue":
      inspection.moduleValue = value;
      break;
    case "integratorValue":
      inspection.integratorValue = value;
      break;
    case "tenantValue":
      inspection.tenantValue = value;
      break;
    case "userValue":
      inspection.userValue = value;
      break;
    case "deviceValue":
      inspection.deviceValue = value;
      break;
    case "sessionValue":
      inspection.sessionValue = value;
      break;
    default:
      break;
  }
}

/**
 * Inspects a specific key across all layers in a stack.
 * Keys are FLAT — the dot-delimited key is looked up directly
 * in each layer's entries record.
 */
export function inspectKey<T>(
  stack: ConfigurationLayerStack,
  key: string,
): ConfigurationInspection<T> {
  const inspection: ConfigurationInspection<T> = {
    key,
    effectiveValue: undefined,
    effectiveLayer: undefined,
  };

  const scopeValues: Array<{ scopeId: string; value: T }> = [];

  for (const layerEntry of stack.layers) {
    if (!(key in layerEntry.entries)) {
      continue;
    }

    const value = layerEntry.entries[key] as T;
    inspection.effectiveValue = value;
    inspection.effectiveLayer = layerEntry.layer;

    const valueKey = LAYER_VALUE_KEYS[layerEntry.layer];
    if (valueKey !== undefined) {
      setInspectionValue(inspection, valueKey, value);
    } else {
      // Dynamic scope layer
      scopeValues.push({ scopeId: layerEntry.layer, value });
    }
  }

  if (scopeValues.length > 0) {
    inspection.scopeValues = scopeValues;
  }

  return inspection;
}

/**
 * Resolves configuration with ceiling enforcement.
 * For each key, if schemaMap has a maxOverrideLayer, values from layers
 * above the ceiling are ignored — UNLESS isEmergencyOverride is true.
 */
export function resolveConfigurationWithCeiling(
  stack: ConfigurationLayerStack,
  schemaMap: Map<string, { maxOverrideLayer?: ConfigurationLayer | undefined }>,
  isEmergencyOverride: boolean,
): ResolvedConfiguration {
  if (isEmergencyOverride) {
    return resolveConfiguration(stack);
  }

  // Build a filtered stack: for each layer, remove keys that exceed their ceiling
  const filteredLayers = stack.layers.map((layerEntry) => {
    const layerRank = getLayerRank(layerEntry.layer);
    const filteredEntries: Record<string, unknown> = {};

    for (const key of Object.keys(layerEntry.entries)) {
      const schema = schemaMap.get(key);
      if (schema?.maxOverrideLayer !== undefined) {
        const ceilingRank = getLayerRank(schema.maxOverrideLayer);
        if (layerRank > ceilingRank) {
          continue; // Skip: this layer is above the ceiling for this key
        }
      }
      filteredEntries[key] = layerEntry.entries[key];
    }

    return { layer: layerEntry.layer, entries: filteredEntries };
  });

  return resolveConfiguration({ layers: filteredLayers });
}
