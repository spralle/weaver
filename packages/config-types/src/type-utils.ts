// Compile-time type utilities for typesafe configuration access

import type { ConfigurationInspection } from "./service.js";
import type { ConfigurationLayer, ScopeInstance } from "./types.js";

/**
 * Union of valid key strings from a configuration schema map.
 * Extracts only string keys from TMap.
 */
export type ConfigKeyPath<TMap extends Record<string, { type: string }>> =
  keyof TMap & string;

/**
 * Maps a schema key path to its TypeScript value type based on the
 * schema's 'type' discriminant field.
 *
 * string → string, number → number, boolean → boolean,
 * object → Record<string, unknown>, array → unknown[], else unknown.
 */
export type ConfigValueAtPath<
  TMap extends Record<string, { type: string }>,
  K extends ConfigKeyPath<TMap>,
> = TMap[K]["type"] extends "string"
  ? string
  : TMap[K]["type"] extends "number"
    ? number
    : TMap[K]["type"] extends "boolean"
      ? boolean
      : TMap[K]["type"] extends "object"
        ? Record<string, unknown>
        : TMap[K]["type"] extends "array"
          ? unknown[]
          : unknown;

/**
 * Generic wrapper over ConfigurationService with strongly-typed
 * get/set signatures narrowed by the schema map TMap.
 */
export interface TypedConfigurationService<
  TMap extends Record<string, { type: string }>,
> {
  get<K extends ConfigKeyPath<TMap>>(
    key: K,
  ): ConfigValueAtPath<TMap, K> | undefined;

  getWithDefault<K extends ConfigKeyPath<TMap>>(
    key: K,
    defaultValue: ConfigValueAtPath<TMap, K>,
  ): ConfigValueAtPath<TMap, K>;

  getAtLayer<K extends ConfigKeyPath<TMap>>(
    layer: ConfigurationLayer | string,
    key: K,
  ): ConfigValueAtPath<TMap, K> | undefined;

  getForScope<K extends ConfigKeyPath<TMap>>(
    key: K,
    scopePath: ScopeInstance[],
  ): ConfigValueAtPath<TMap, K> | undefined;

  inspect<K extends ConfigKeyPath<TMap>>(
    key: K,
  ): ConfigurationInspection<ConfigValueAtPath<TMap, K>>;

  set<K extends ConfigKeyPath<TMap>>(
    key: K,
    value: ConfigValueAtPath<TMap, K>,
    layer?: ConfigurationLayer | undefined,
  ): void;

  remove(key: ConfigKeyPath<TMap>, layer: ConfigurationLayer): void;

  onChange<K extends ConfigKeyPath<TMap>>(
    key: K,
    listener: (value: ConfigValueAtPath<TMap, K>) => void,
  ): () => void;

  getNamespace(prefix: string): Record<string, unknown>;
}
