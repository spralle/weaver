// Secret integration — shadow map pattern for sync secret access

import type { SecretResolutionService } from "@weaver/config-secrets";
import type { SecretReference } from "@weaver/config-types";
import { isSecretReference } from "@weaver/config-types";

export interface SecretIntegrationOptions {
  /** The resolution service with providers registered */
  readonly service: SecretResolutionService;
  /** How often to re-resolve secrets (ms). 0 = no background refresh. Default: 0 */
  readonly refreshIntervalMs?: number;
  /** Called when background refresh fails */
  readonly onRefreshError?: (error: unknown) => void;
}

export interface SecretIntegrationHandle {
  /** Sync lookup of a pre-resolved secret by config key. Returns undefined on cache miss. */
  getResolved(key: string): string | undefined;
  /** Whether a config key holds a SecretReference */
  hasSecret(key: string): boolean;
  /** Store plaintext as a secret, returns the reference to persist in config layer */
  storeAsSecret(
    provider: string,
    uri: string,
    plaintext: string,
  ): Promise<SecretReference>;
  /** Re-resolve all secrets from current entries. Call when entries change. */
  refresh(entries: Readonly<Record<string, unknown>>): Promise<void>;
  /** Stop background refresh and clean up */
  dispose(): void;
}

/**
 * Creates a secret integration handle. Pre-resolves all SecretReference values
 * in initialEntries. Maintains a sync-accessible shadow map for get().
 */
export async function createSecretIntegration(
  initialEntries: Readonly<Record<string, unknown>>,
  options: SecretIntegrationOptions,
): Promise<SecretIntegrationHandle> {
  const { service } = options;
  const resolvedSecrets = new Map<string, string>();
  const secretKeys = new Set<string>();

  async function resolveAll(
    entries: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    const result = await service.resolveAll(
      entries as Record<string, unknown>,
    );
    resolvedSecrets.clear();
    secretKeys.clear();
    for (const [key, value] of result.resolved) {
      resolvedSecrets.set(key, value);
      secretKeys.add(key);
    }
    // Track secret keys that may have failed to resolve
    for (const [key, value] of Object.entries(entries)) {
      if (isSecretReference(value)) {
        secretKeys.add(key);
      }
    }
  }

  await resolveAll(initialEntries);

  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let latestEntries: Readonly<Record<string, unknown>> = initialEntries;

  if (
    options.refreshIntervalMs !== undefined &&
    options.refreshIntervalMs > 0
  ) {
    refreshTimer = setInterval(() => {
      resolveAll(latestEntries).catch(options.onRefreshError ?? ((err) => {
        console.warn("[weaver] secret refresh failed:", err);
      }));
    }, options.refreshIntervalMs);
  }

  return {
    getResolved(key: string): string | undefined {
      return resolvedSecrets.get(key);
    },

    hasSecret(key: string): boolean {
      return secretKeys.has(key);
    },

    async storeAsSecret(
      provider: string,
      uri: string,
      plaintext: string,
    ): Promise<SecretReference> {
      await service.store(provider, uri, plaintext);
      return { _weaver: "secret-ref", provider, uri } as const;
    },

    async refresh(
      entries: Readonly<Record<string, unknown>>,
    ): Promise<void> {
      latestEntries = entries;
      await resolveAll(entries);
    },

    dispose(): void {
      if (refreshTimer !== undefined) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
      }
    },
  };
}
