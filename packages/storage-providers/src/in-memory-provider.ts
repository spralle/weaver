// In-memory configuration storage provider — SESSION layer and test double

import { deepRemove, deepSet } from "@weaver-conf/config-engine";
import type {
  ConfigurationLayer,
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  WriteResult,
} from "@weaver-conf/config-types";

/** Options for creating an in-memory storage provider (useful for tests and session layers). */
export interface InMemoryProviderOptions {
  id: string;
  layer: ConfigurationLayer | string;
  initialEntries?: Record<string, unknown> | undefined;
}

/** @see {@link createInMemoryStorageProvider} — prefer the factory function for consistency */
class InMemoryStorageProvider implements ConfigurationStorageProvider {
  readonly id: string;
  readonly layer: ConfigurationLayer | string;
  readonly writable = true as const;

  private entries: Record<string, unknown>;
  private scopedEntries = new Map<string, Record<string, unknown>>();

  constructor(options: InMemoryProviderOptions) {
    this.id = options.id;
    this.layer = options.layer;
    this.entries =
      options.initialEntries !== undefined ? { ...options.initialEntries } : {};
  }

  async load(): Promise<ConfigurationLayerData> {
    return { entries: { ...this.entries } };
  }

  async loadLayer(layer: string): Promise<ConfigurationLayerData> {
    if (layer === this.layer) {
      return { entries: { ...this.entries } };
    }

    const entries = this.scopedEntries.get(layer);
    return { entries: entries ? { ...entries } : {} };
  }

  async write(key: string, value: unknown): Promise<WriteResult> {
    deepSet(this.entries, key, value);
    return { success: true };
  }

  async writeLayer(
    layer: string,
    key: string,
    value: unknown,
  ): Promise<WriteResult> {
    if (layer === this.layer) {
      deepSet(this.entries, key, value);
      return { success: true };
    }

    const current = this.scopedEntries.get(layer) ?? {};
    deepSet(current, key, value);
    this.scopedEntries.set(layer, current);
    return { success: true };
  }

  async remove(key: string): Promise<WriteResult> {
    deepRemove(this.entries, key);
    return { success: true };
  }

  async removeLayer(layer: string, key: string): Promise<WriteResult> {
    if (layer === this.layer) {
      deepRemove(this.entries, key);
      return { success: true };
    }

    const current = this.scopedEntries.get(layer) ?? {};
    deepRemove(current, key);
    this.scopedEntries.set(layer, current);
    return { success: true };
  }
}

/** Creates an in-memory storage provider instance. */
export function createInMemoryStorageProvider(
  options: InMemoryProviderOptions,
): ConfigurationStorageProvider {
  return new InMemoryStorageProvider(options);
}
