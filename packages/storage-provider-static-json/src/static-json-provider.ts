// Static JSON configuration storage provider — read-only layers (CORE, APP, MODULE)

import { readonlyGuard } from "@weaver/config-engine";
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

class StaticJsonStorageProvider implements ConfigurationStorageProvider {
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
    return {
      entries: JSON.parse(JSON.stringify(this.data)) as Record<string, unknown>, // SAFETY: this.data is Record<string, unknown>, JSON roundtrip preserves structure
    };
  }

  async write(_key: string, _value: unknown): Promise<WriteResult> {
    return readonlyGuard("StaticJsonStorageProvider");
  }

  async remove(_key: string): Promise<WriteResult> {
    return readonlyGuard("StaticJsonStorageProvider");
  }
}

/** Creates a read-only static JSON storage provider instance. */
export function createStaticJsonStorageProvider(
  options: StaticJsonProviderOptions,
): ConfigurationStorageProvider {
  return new StaticJsonStorageProvider(options);
}
