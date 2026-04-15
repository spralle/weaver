// In-memory configuration storage provider — SESSION layer and test double

import type {
  ConfigurationLayer,
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  WriteResult,
} from "@weaver/config-types";

export interface InMemoryProviderOptions {
  id: string;
  layer: ConfigurationLayer | string;
  initialEntries?: Record<string, unknown> | undefined;
}

export class InMemoryStorageProvider implements ConfigurationStorageProvider {
  readonly id: string;
  readonly layer: ConfigurationLayer | string;
  readonly writable = true as const;

  private entries: Record<string, unknown>;

  constructor(options: InMemoryProviderOptions) {
    this.id = options.id;
    this.layer = options.layer;
    this.entries = options.initialEntries !== undefined
      ? { ...options.initialEntries }
      : {};
  }

  async load(): Promise<ConfigurationLayerData> {
    return { entries: { ...this.entries } };
  }

  async write(key: string, value: unknown): Promise<WriteResult> {
    this.entries[key] = value;
    return { success: true };
  }

  async remove(key: string): Promise<WriteResult> {
    delete this.entries[key];
    return { success: true };
  }
}
