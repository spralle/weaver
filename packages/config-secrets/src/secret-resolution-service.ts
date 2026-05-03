import { isSecretReference } from "@weaver/config-types";
import type { SecretReference } from "@weaver/config-types";
import { SecretCache } from "./secret-cache.js";
import type { SecretProvider, SecretStoreResult } from "./secret-provider.js";

export interface SecretAuditEntry {
  readonly action: "resolve" | "store" | "delete" | "invalidate" | "cache-hit";
  readonly provider: string;
  readonly uri: string;
  readonly timestamp: number;
  readonly success: boolean;
  readonly error?: string | undefined;
}

export interface SecretAuditLog {
  log(entry: SecretAuditEntry): void;
}

export interface SecretResolutionServiceOptions {
  readonly cacheTtlMs?: number;
  readonly maxCacheEntries?: number;
  readonly auditLog?: SecretAuditLog | undefined;
}

export class SecretResolutionService {
  private readonly providers = new Map<string, SecretProvider>();
  private readonly cache: SecretCache;
  private readonly auditLog: SecretAuditLog | undefined;

  constructor(options: SecretResolutionServiceOptions = {}) {
    this.cache = new SecretCache({
      ...(options.cacheTtlMs !== undefined && { defaultTtlMs: options.cacheTtlMs }),
      ...(options.maxCacheEntries !== undefined && { maxEntries: options.maxCacheEntries }),
    });
    this.auditLog = options.auditLog;
  }

  registerProvider(provider: SecretProvider): void {
    this.providers.set(provider.name, provider);
  }

  async resolve(ref: SecretReference): Promise<string> {
    const cacheKey = `${ref.provider}:${ref.uri}:${ref.version ?? ""}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.audit("cache-hit", ref.provider, ref.uri, true);
      return cached.value;
    }

    const provider = this.getProvider(ref.provider);
    try {
      const result = await provider.resolve(ref);
      this.cache.set(cacheKey, result.value, result.version);
      this.audit("resolve", ref.provider, ref.uri, true);
      return result.value;
    } catch (err) {
      this.audit("resolve", ref.provider, ref.uri, false, errorMessage(err));
      throw err;
    }
  }

  async resolveAll(
    entries: Record<string, unknown>,
  ): Promise<Map<string, string>> {
    const refs: Array<{ key: string; ref: SecretReference }> = [];
    for (const [key, value] of Object.entries(entries)) {
      if (isSecretReference(value)) {
        refs.push({ key, ref: value });
      }
    }

    const results = await Promise.all(
      refs.map(async ({ key, ref }) => {
        const value = await this.resolve(ref);
        return { key, value };
      }),
    );

    const map = new Map<string, string>();
    for (const { key, value } of results) {
      map.set(key, value);
    }
    return map;
  }

  async store(
    provider: string,
    uri: string,
    value: string,
  ): Promise<SecretStoreResult> {
    const p = this.getProvider(provider);
    try {
      const result = await p.store(uri, value);
      this.audit("store", provider, uri, true);
      return result;
    } catch (err) {
      this.audit("store", provider, uri, false, errorMessage(err));
      throw err;
    }
  }

  async delete(provider: string, uri: string): Promise<void> {
    const p = this.getProvider(provider);
    try {
      await p.delete(uri);
      this.cache.invalidate(`${provider}:${uri}:`);
      this.audit("delete", provider, uri, true);
    } catch (err) {
      this.audit("delete", provider, uri, false, errorMessage(err));
      throw err;
    }
  }

  invalidate(key: string): void {
    this.cache.invalidate(key);
  }

  invalidateAll(): void {
    this.cache.invalidateAll();
  }

  shutdown(): void {
    this.cache.invalidateAll();
  }

  private getProvider(name: string): SecretProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Secret provider "${name}" not registered`);
    }
    return provider;
  }

  private audit(
    action: SecretAuditEntry["action"],
    provider: string,
    uri: string,
    success: boolean,
    error?: string,
  ): void {
    this.auditLog?.log({ action, provider, uri, timestamp: Date.now(), success, error });
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
