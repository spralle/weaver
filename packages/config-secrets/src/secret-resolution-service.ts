import { isSecretReference } from "@weaver/config-types";
import type { SecretReference, SecretDomainAuditEntry } from "@weaver/config-types";
import { createSecretCache } from "./secret-cache.js";
import type { SecretCache } from "./secret-cache.js";
import type { SecretProvider, SecretStoreResult } from "./secret-provider.js";

export interface SecretAuditLog {
  log(entry: SecretDomainAuditEntry): void;
}

export interface SecretResolutionFailure {
  readonly key: string;
  readonly provider: string;
  readonly uri: string;
  readonly error: string;
}

export interface SecretResolutionResult {
  readonly resolved: Map<string, string>;
  readonly failures: readonly SecretResolutionFailure[];
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
    this.cache = createSecretCache({
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
  ): Promise<SecretResolutionResult> {
    const refs: Array<{ key: string; ref: SecretReference }> = [];
    for (const [key, value] of Object.entries(entries)) {
      if (isSecretReference(value)) {
        refs.push({ key, ref: value });
      }
    }

    const settled = await Promise.allSettled(
      refs.map(async ({ key, ref }) => {
        const value = await this.resolve(ref);
        return { key, value };
      }),
    );

    const resolved = new Map<string, string>();
    const failures: SecretResolutionFailure[] = [];

    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i]!;
      const { key, ref } = refs[i]!;
      if (outcome.status === "fulfilled") {
        resolved.set(outcome.value.key, outcome.value.value);
      } else {
        failures.push({
          key,
          provider: ref.provider,
          uri: ref.uri,
          error: errorMessage(outcome.reason),
        });
      }
    }

    return { resolved, failures };
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
    action: SecretDomainAuditEntry["action"],
    provider: string,
    uri: string,
    success: boolean,
    error?: string,
  ): void {
    this.auditLog?.log({
      domain: "secret",
      action,
      actor: "system",
      provider,
      uri,
      timestamp: new Date().toISOString(),
      success,
      error,
    });
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Creates a secret resolution service instance. */
export function createSecretResolutionService(
  options?: SecretResolutionServiceOptions,
): SecretResolutionService {
  return new SecretResolutionService(options);
}
