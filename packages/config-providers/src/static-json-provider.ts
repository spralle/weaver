// Static JSON configuration storage provider — read-only layers (CORE, APP, MODULE)

import type {
  ConfigurationLayer,
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  WriteResult,
} from "@weaver/config-types";

export interface StaticJsonProviderOptions {
  id: string;
  layer: ConfigurationLayer | string;
  data: Record<string, unknown>;
}

export class StaticJsonStorageProvider implements ConfigurationStorageProvider {
  readonly id: string;
  readonly layer: ConfigurationLayer | string;
  readonly writable = false as const;

  private readonly data: Record<string, unknown>;

  constructor(options: StaticJsonProviderOptions) {
    this.id = options.id;
    this.layer = options.layer;
    this.data = options.data;
  }

  async load(): Promise<ConfigurationLayerData> {
    return { entries: structuredClone(this.data) };
  }

  async write(_key: string, _value: unknown): Promise<WriteResult> {
    return { success: false, error: "StaticJsonStorageProvider is read-only" };
  }

  async remove(_key: string): Promise<WriteResult> {
    return { success: false, error: "StaticJsonStorageProvider is read-only" };
  }
}
