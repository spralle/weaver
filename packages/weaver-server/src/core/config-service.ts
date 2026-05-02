// WeaverConfigService — server-side config service wrapping storage providers
import type {
  ConfigurationInspection,
  ConfigurationStorageProvider,
  WriteResult,
} from "@weaver/config-types";
import type { ConfigSnapshot, ConfigDelta } from "../types/index.js";

export interface WriteContext {
  environment?: string;
  tenantId?: string;
  actor?: string;
}

export interface WeaverConfigServiceOptions {
  providers: ConfigurationStorageProvider[];
  environment: string;
}

type Unsubscribe = () => void;

export interface WeaverConfigService {
  resolveAll(
    serviceId: string,
    options?: { tenantId?: string },
  ): Promise<ConfigSnapshot>;
  get(
    serviceId: string,
    key: string,
    options?: { tenantId?: string },
  ): Promise<unknown>;
  getNamespace(
    serviceId: string,
    prefix: string,
    options?: { tenantId?: string },
  ): Promise<Record<string, unknown>>;
  inspect(
    serviceId: string,
    key: string,
  ): Promise<ConfigurationInspection<unknown>>;
  readonly providers: ReadonlyArray<ConfigurationStorageProvider>;
  readonly revision: string;
  reloadProvider(providerId: string): Promise<void>;
  set(
    layer: string,
    key: string,
    value: unknown,
    options?: WriteContext,
  ): Promise<WriteResult>;
  remove(layer: string, key: string, options?: WriteContext): Promise<WriteResult>;
  onDelta(handler: (delta: ConfigDelta) => void): Unsubscribe;
}

const SIZE_WARNING = 1_048_576; // 1MB

function computeRevision(state: Record<string, unknown>): string {
  const content = JSON.stringify(state);
  // Simple hash based on content length + checksum chars
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return `rev-${(hash >>> 0).toString(36)}-${Date.now().toString(36)}`;
}

function isTenantLayer(layer: string): boolean {
  return layer.startsWith("tenant:");
}

function extractTenantId(layer: string): string {
  return layer.slice("tenant:".length);
}

export async function createWeaverConfigService(
  options: WeaverConfigServiceOptions,
): Promise<WeaverConfigService> {
  const { providers, environment } = options;

  // Per-provider loaded entries
  const layerData = new Map<string, Record<string, unknown>>();
  let revision = "";
  const deltaHandlers = new Set<(delta: ConfigDelta) => void>();

  // Load all providers
  for (const provider of providers) {
    const data = await provider.load();
    layerData.set(provider.id, data.entries);
  }

  function getMergedPlatformState(): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const provider of providers) {
      if (isTenantLayer(provider.layer)) continue;
      const entries = layerData.get(provider.id) ?? {};
      Object.assign(merged, entries);
    }
    return merged;
  }

  function getTenantState(tenantId: string): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const provider of providers) {
      if (provider.layer === `tenant:${tenantId}`) {
        const entries = layerData.get(provider.id) ?? {};
        Object.assign(merged, entries);
      }
    }
    return merged;
  }

  function getAllTenants(): Record<string, Record<string, unknown>> {
    const tenants: Record<string, Record<string, unknown>> = {};
    for (const provider of providers) {
      if (!isTenantLayer(provider.layer)) continue;
      const tid = extractTenantId(provider.layer);
      const entries = layerData.get(provider.id) ?? {};
      tenants[tid] = { ...(tenants[tid] ?? {}), ...entries };
    }
    return tenants;
  }

  function getMergedState(tenantId?: string): Record<string, unknown> {
    const platform = getMergedPlatformState();
    if (!tenantId) return platform;
    return { ...platform, ...getTenantState(tenantId) };
  }

  function updateRevision(): void {
    revision = computeRevision(getMergedPlatformState());
  }

  updateRevision();

  function fireDelta(delta: ConfigDelta): void {
    for (const handler of deltaHandlers) {
      handler(delta);
    }
  }

  return {
    get providers() {
      return providers;
    },

    get revision() {
      return revision;
    },

    async resolveAll(
      _serviceId: string,
      opts?: { tenantId?: string },
    ): Promise<ConfigSnapshot> {
      const platform = getMergedPlatformState();
      const tenants = opts?.tenantId
        ? { [opts.tenantId]: getTenantState(opts.tenantId) }
        : getAllTenants();

      return {
        platform,
        tenants,
        revision,
        timestamp: new Date().toISOString(),
      };
    },

    async get(
      _serviceId: string,
      key: string,
      opts?: { tenantId?: string },
    ): Promise<unknown> {
      const state = getMergedState(opts?.tenantId);
      return state[key];
    },

    async getNamespace(
      _serviceId: string,
      prefix: string,
      opts?: { tenantId?: string },
    ): Promise<Record<string, unknown>> {
      const state = getMergedState(opts?.tenantId);
      const dotPrefix = `${prefix}.`;
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(state)) {
        if (key.startsWith(dotPrefix)) {
          result[key] = value;
        }
      }
      return result;
    },

    async inspect(
      _serviceId: string,
      key: string,
    ): Promise<ConfigurationInspection<unknown>> {
      const layerValues: Record<string, unknown> = {};
      let effectiveValue: unknown = undefined;
      let effectiveLayer: string | undefined = undefined;

      for (const provider of providers) {
        const entries = layerData.get(provider.id) ?? {};
        if (key in entries) {
          layerValues[provider.layer] = entries[key];
          effectiveValue = entries[key];
          effectiveLayer = provider.layer;
        }
      }

      return { key, effectiveValue, effectiveLayer, layerValues };
    },

    async reloadProvider(providerId: string): Promise<void> {
      const provider = providers.find((p) => p.id === providerId);
      if (!provider) return;
      const data = await provider.load();
      layerData.set(provider.id, data.entries);
      updateRevision();
    },

    async set(
      layer: string,
      key: string,
      value: unknown,
      opts?: WriteContext,
    ): Promise<WriteResult> {
      const provider = providers.find((p) => p.layer === layer);
      if (!provider) {
        return { success: false, error: `No provider for layer "${layer}"` };
      }
      if (!provider.writable) {
        return { success: false, error: `Provider for layer "${layer}" is read-only` };
      }

      if (typeof value === "string" && value.length > SIZE_WARNING) {
        console.warn(
          `[weaver] Value for key "${key}" exceeds 1MB (${value.length} bytes)`,
        );
      }

      const result = await provider.write(key, value);
      if (!result.success) return result;

      // Update local state
      const entries = layerData.get(provider.id) ?? {};
      entries[key] = value;
      layerData.set(provider.id, entries);
      updateRevision();

      const delta: ConfigDelta = {
        action: "set",
        key,
        value,
        layer,
        environment: opts?.environment ?? environment,
        timestamp: new Date().toISOString(),
      };
      fireDelta(delta);

      return result;
    },

    async remove(
      layer: string,
      key: string,
      opts?: WriteContext,
    ): Promise<WriteResult> {
      const provider = providers.find((p) => p.layer === layer);
      if (!provider) {
        return { success: false, error: `No provider for layer "${layer}"` };
      }
      if (!provider.writable) {
        return { success: false, error: `Provider for layer "${layer}" is read-only` };
      }

      const result = await provider.remove(key);
      if (!result.success) return result;

      const entries = layerData.get(provider.id) ?? {};
      delete entries[key];
      layerData.set(provider.id, entries);
      updateRevision();

      const delta: ConfigDelta = {
        action: "remove",
        key,
        value: null,
        layer,
        environment: opts?.environment ?? environment,
        timestamp: new Date().toISOString(),
      };
      fireDelta(delta);

      return result;
    },

    onDelta(handler: (delta: ConfigDelta) => void): Unsubscribe {
      deltaHandlers.add(handler);
      return () => {
        deltaHandlers.delete(handler);
      };
    },
  };
}
