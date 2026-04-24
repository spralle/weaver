import type { LayerDefinition } from "./layers.js";

// --- Type-level utilities ---

/** Extract layer names from a tuple of LayerDefinitions */
export type ExtractLayerNames<T extends readonly LayerDefinition[]> =
  T[number]["name"];

/** The typed configuration object returned by defineWeaver() */
export interface WeaverConfig<
  T extends readonly LayerDefinition[] = readonly LayerDefinition[],
> {
  readonly layers: T;
  readonly layerNames: ReadonlyArray<ExtractLayerNames<T>>;
  readonly rankMap: ReadonlyMap<string, number>;

  /** Get rank for a layer name. Returns -1 for unknown layers. */
  getRank(layer: string): number;

  /** Get layer definition by name */
  getLayer<N extends ExtractLayerNames<T>>(
    name: N,
  ): LayerDefinition<N> | undefined;

  /** Get all layer definitions of a given type */
  getLayersByType(typeId: string): readonly LayerDefinition[];
}

/**
 * Create a typed weaver configuration from an as-const layer array.
 * Order in the array determines rank (index = rank).
 */
export function defineWeaver<const T extends readonly LayerDefinition[]>(
  layers: T,
): WeaverConfig<T> {
  const names = layers.map((l) => l.name);

  // Validate no duplicate names
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) {
      throw new Error(`Duplicate layer name: "${name}"`);
    }
    seen.add(name);
  }

  // Build rank map — position = rank
  const rankMap = new Map<string, number>();
  for (let i = 0; i < layers.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: index is within bounds of layers.length
    rankMap.set(layers[i]!.name, i);
  }

  return {
    layers,
    layerNames: names as unknown as ReadonlyArray<ExtractLayerNames<T>>,
    rankMap,
    getRank(layer: string): number {
      return rankMap.get(layer) ?? -1;
    },
    getLayer<N extends string>(name: N): LayerDefinition<N> | undefined {
      return layers.find((l) => l.name === name) as
        | LayerDefinition<N>
        | undefined;
    },
    getLayersByType(typeId: string): readonly LayerDefinition[] {
      return layers.filter((l) => l.type.id === typeId);
    },
  };
}
