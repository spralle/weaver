// WeaverConfigService — server-side config service wrapping storage providers
import type {
  ConfigurationInspection,
  ConfigurationStorageProvider,
  ScopeInstance,
  WriteResult,
} from "@weaver/config-types";
import type { ConfigSnapshot, ConfigDelta } from "../types/index.js";
import { isScopedLayer, parseScopeLayer, buildScopePathString } from "./scope-utils.js";

export interface WriteContext {
  environment?: string;
  scopePath?: ScopeInstance[];
  actor?: string;
}

export interface WeaverConfigServiceOptions {
  providers: ConfigurationStorageProvider[];
  environment: string;
}

type Unsubscribe = () => void;

export interface WeaverConfigService {
  resolveAll(
    options?: { scopePath?: ScopeInstance[] },
  ): Promise<ConfigSnapshot>;
  get(
    key: string,
    options?: { scopePath?: ScopeInstance[] },
  ): Promise<unknown>;
  getNamespace(
    prefix: string,
    options?: { scopePath?: ScopeInstance[] },
  ): Promise<Record<string, unknown>>;
  inspect(
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
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return `rev-${(hash >>> 0).toString(36)}-${Date.now().toString(36)}`;
}

export async function createWeaverConfigService(
  options: WeaverConfigServiceOptions,
): Promise<WeaverConfigService> {
  const { providers, environment } = options;

  const layerData = new Map<string, Record<string, unknown>>();
  let revision = "";
  const deltaHandlers = new Set<(delta: ConfigDelta) => void>();

  for (const provider of providers) {
    const data = await provider.load();
    layerData.set(provider.id, data.entries);
  }

  function getBaseEntries(): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const provider of providers) {
      if (isScopedLayer(provider.layer)) continue;
      const entries = layerData.get(provider.id) ?? {};
      Object.assign(merged, entries);
    }
    return merged;
  }

  function getScopeState(scopePath: ScopeInstance[]): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const scope of scopePath) {
      const layerName = `${scope.scopeId}:${scope.value}`;
      for (const provider of providers) {
        if (provider.layer === layerName) {
          const entries = layerData.get(provider.id) ?? {};
          Object.assign(merged, entries);
        }
      }
    }
    return merged;
  }

  function getAllScopes(): Record<string, Record<string, unknown>> {
    const scopes: Record<string, Record<string, unknown>> = {};
    for (const provider of providers) {
      if (!isScopedLayer(provider.layer)) continue;
      const entries = layerData.get(provider.id) ?? {};
      scopes[provider.layer] = { ...(scopes[provider.layer] ?? {}), ...entries };
    }
    return scopes;
  }

  function getMergedState(scopePath?: ScopeInstance[]): Record<string, unknown> {
    const base = getBaseEntries();
    if (!scopePath?.length) return base;
    return { ...base, ...getScopeState(scopePath) };
  }

  function updateRevision(): void {
    revision = computeRevision(getBaseEntries());
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
      opts?: { scopePath?: ScopeInstance[] },
    ): Promise<ConfigSnapshot> {
      const entries = getBaseEntries();
      const scopes = opts?.scopePath?.length
        ? { [buildScopePathString(opts.scopePath)]: getScopeState(opts.scopePath) }
        : getAllScopes();

      return {
        entries,
        scopes,
        revision,
        timestamp: new Date().toISOString(),
      };
    },

    async get(
      key: string,
      opts?: { scopePath?: ScopeInstance[] },
    ): Promise<unknown> {
      const state = getMergedState(opts?.scopePath);
      return state[key];
    },

    async getNamespace(
      prefix: string,
      opts?: { scopePath?: ScopeInstance[] },
    ): Promise<Record<string, unknown>> {
      const state = getMergedState(opts?.scopePath);
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
