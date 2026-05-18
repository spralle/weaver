// WeaverConfigService — server-side config service wrapping storage providers

import type { WeaverLogger } from "@weaver/config-engine";
import {
  consoleLogger,
  deepGet,
  deepMerge,
  deepRemove,
  deepSet,
} from "@weaver/config-engine";
import type {
  ConfigurationInspection,
  ConfigurationStorageProvider,
  ScopeInstance,
  WriteResult,
} from "@weaver/config-types";
import type { ConfigDelta, ConfigSnapshot } from "../types/index.js";
import { buildScopePathString, isScopedLayer } from "./scope-utils.js";

export interface WriteContext {
  environment?: string;
  scopePath?: ScopeInstance[];
  actor?: string;
  expectedRevision?: string;
}

export interface WeaverConfigServiceOptions {
  providers: ConfigurationStorageProvider[];
  environment: string;
  logger?: WeaverLogger;
  flushDebounceMs?: number;
}

type Unsubscribe = () => void;

export interface WeaverConfigService {
  resolveAll(options?: {
    scopePath?: ScopeInstance[];
  }): Promise<ConfigSnapshot>;
  get(key: string, options?: { scopePath?: ScopeInstance[] }): Promise<unknown>;
  getNamespace(
    prefix: string,
    options?: { scopePath?: ScopeInstance[] },
  ): Promise<Record<string, unknown>>;
  inspect(key: string): Promise<ConfigurationInspection<unknown>>;
  readonly providers: ReadonlyArray<ConfigurationStorageProvider>;
  readonly degradedProviders: ReadonlyArray<string>;
  readonly revision: string;
  reloadProvider(providerId: string): Promise<void>;
  set(
    layer: string,
    key: string,
    value: unknown,
    options?: WriteContext,
  ): Promise<WriteResult>;
  remove(
    layer: string,
    key: string,
    options?: WriteContext,
  ): Promise<WriteResult>;
  onDelta(handler: (delta: ConfigDelta) => void): Unsubscribe;
  /** Group multiple writes into one commit. Auto-flushes at the end. */
  batch<T>(fn: () => Promise<T>): Promise<T>;
  /** Write multiple key-value pairs in a single batch. */
  setMany(
    layer: string,
    entries: Record<string, unknown>,
    options?: WriteContext,
  ): Promise<WriteResult>;
  /** Flush all dirty providers. Rarely needed — set/remove auto-flush. */
  flush(): Promise<void>;
  /** Refresh all providers from remote sources, then reload state. */
  refreshProviders(): Promise<void>;
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
  const { providers: inputProviders, environment } = options;
  const logger = options.logger ?? consoleLogger;
  const flushDebounceMs = options.flushDebounceMs ?? 500;

  const layerData = new Map<string, Record<string, unknown>>();
  const degradedProviders: string[] = [];
  let revision = "";
  const deltaHandlers = new Set<(delta: ConfigDelta) => void>();
  let batchDepth = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function flushAllDirty(): Promise<void> {
    for (const provider of providers) {
      if (provider.flush && provider.dirty) {
        await provider.flush();
      }
    }
  }

  function autoFlush(): void {
    if (batchDepth > 0) return;
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      flushAllDirty().catch((err) =>
        logger.error("[config] flush failed:", err),
      );
    }, flushDebounceMs);
  }

  function checkRevision(
    expectedRevision: string | undefined,
  ): WriteResult | null {
    if (expectedRevision === undefined) return null;
    if (expectedRevision !== revision) {
      return {
        success: false,
        error: `Revision conflict: expected ${expectedRevision}, current is ${revision}`,
      };
    }
    return null;
  }

  const activeProviders: ConfigurationStorageProvider[] = [];
  for (const provider of inputProviders) {
    try {
      const data = await provider.load();
      layerData.set(provider.id, data.entries);
      activeProviders.push(provider);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        `[weaver] Provider "${provider.id}" failed to load: ${message}`,
      );
      degradedProviders.push(provider.id);
    }
  }

  const providers = activeProviders;

  function getBaseEntries(): Record<string, unknown> {
    let merged: Record<string, unknown> = {};
    for (const provider of providers) {
      if (isScopedLayer(provider.layer)) continue;
      const entries = layerData.get(provider.id) ?? {};
      merged = deepMerge(merged, entries);
    }
    return merged;
  }

  function getScopeState(scopePath: ScopeInstance[]): Record<string, unknown> {
    let merged: Record<string, unknown> = {};
    for (const scope of scopePath) {
      const layerName = `${scope.scopeId}:${scope.value}`;
      for (const provider of providers) {
        if (provider.layer === layerName) {
          const entries = layerData.get(provider.id) ?? {};
          merged = deepMerge(merged, entries);
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
      scopes[provider.layer] = {
        ...(scopes[provider.layer] ?? {}),
        ...entries,
      };
    }
    return scopes;
  }

  function getMergedState(
    scopePath?: ScopeInstance[],
  ): Record<string, unknown> {
    const base = getBaseEntries();
    if (!scopePath?.length) return base;
    return deepMerge(base, getScopeState(scopePath));
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

  const service: WeaverConfigService = {
    get providers() {
      return providers;
    },

    get degradedProviders() {
      return degradedProviders as ReadonlyArray<string>;
    },

    get revision() {
      return revision;
    },

    async resolveAll(opts?: {
      scopePath?: ScopeInstance[];
    }): Promise<ConfigSnapshot> {
      const entries = getBaseEntries();
      const scopes = opts?.scopePath?.length
        ? {
            [buildScopePathString(opts.scopePath)]: getScopeState(
              opts.scopePath,
            ),
          }
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
      return deepGet(state, key);
    },

    async getNamespace(
      prefix: string,
      opts?: { scopePath?: ScopeInstance[] },
    ): Promise<Record<string, unknown>> {
      const state = getMergedState(opts?.scopePath);
      const value = deepGet(state, prefix);
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        return value as Record<string, unknown>;
      }
      return {};
    },

    async inspect(key: string): Promise<ConfigurationInspection<unknown>> {
      const layerValues: Record<string, unknown> = {};
      let effectiveValue: unknown;
      let effectiveLayer: string | undefined;

      for (const provider of providers) {
        const entries = layerData.get(provider.id) ?? {};
        const value = deepGet(entries, key);
        if (value !== undefined) {
          layerValues[provider.layer] = value;
          effectiveValue = value;
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
      const revConflict = checkRevision(opts?.expectedRevision);
      if (revConflict) return revConflict;

      const provider = providers.find((p) => p.layer === layer);
      if (!provider) {
        return { success: false, error: `No provider for layer "${layer}"` };
      }
      if (!provider.writable) {
        return {
          success: false,
          error: `Provider for layer "${layer}" is read-only`,
        };
      }

      if (typeof value === "string" && value.length > SIZE_WARNING) {
        logger.warn(
          `[weaver] Value for key "${key}" exceeds 1MB (${value.length} bytes)`,
        );
      }

      const result = await provider.write(key, value);
      if (!result.success) return result;

      const entries = layerData.get(provider.id) ?? {};
      deepSet(entries, key, value);
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

      autoFlush();
      return result;
    },

    async remove(
      layer: string,
      key: string,
      opts?: WriteContext,
    ): Promise<WriteResult> {
      const revConflict = checkRevision(opts?.expectedRevision);
      if (revConflict) return revConflict;

      const provider = providers.find((p) => p.layer === layer);
      if (!provider) {
        return { success: false, error: `No provider for layer "${layer}"` };
      }
      if (!provider.writable) {
        return {
          success: false,
          error: `Provider for layer "${layer}" is read-only`,
        };
      }

      const result = await provider.remove(key);
      if (!result.success) return result;

      const entries = layerData.get(provider.id) ?? {};
      deepRemove(entries, key);
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

      autoFlush();
      return result;
    },

    onDelta(handler: (delta: ConfigDelta) => void): Unsubscribe {
      deltaHandlers.add(handler);
      return () => {
        deltaHandlers.delete(handler);
      };
    },

    async batch<T>(fn: () => Promise<T>): Promise<T> {
      batchDepth++;
      try {
        const result = await fn();
        return result;
      } finally {
        batchDepth--;
        if (batchDepth === 0) {
          await flushAllDirty();
        }
      }
    },

    async flush(): Promise<void> {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      await flushAllDirty();
    },

    async refreshProviders(): Promise<void> {
      for (const provider of providers) {
        if (provider.refresh) {
          await provider.refresh();
        }
        const data = await provider.load();
        layerData.set(provider.id, data.entries);
      }
      updateRevision();
    },

    async setMany(
      layer: string,
      entries: Record<string, unknown>,
      opts?: WriteContext,
    ): Promise<WriteResult> {
      return service.batch(async () => {
        for (const [key, value] of Object.entries(entries)) {
          const result = await service.set(layer, key, value, opts);
          if (!result.success) return result;
        }
        return { success: true, revision };
      });
    },
  };

  return service;
}
