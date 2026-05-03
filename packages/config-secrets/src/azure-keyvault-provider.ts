import { SecretClient } from "@azure/keyvault-secrets";
import type { TokenCredential } from "@azure/identity";
import type { SecretReference } from "@weaver/config-types";
import type {
  SecretProvider,
  SecretProviderHealth,
  SecretStoreResult,
  SecretValue,
} from "./secret-provider.js";

export class SecretResolutionError extends Error {
  readonly code = "SECRET_RESOLUTION_ERROR" as const;
  readonly provider: string;
  readonly uri: string;
  readonly cause: unknown;

  constructor(provider: string, uri: string, cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`Secret resolution failed [${provider}:${uri}]: ${msg}`);
    this.name = "SecretResolutionError";
    this.provider = provider;
    this.uri = uri;
    this.cause = cause;
  }
}

export interface CircuitBreakerOptions {
  readonly failureThreshold?: number;
  readonly cooldownMs?: number;
}

export interface AzureKeyVaultProviderOptions {
  readonly vaultUrl: string;
  readonly credential: TokenCredential;
  readonly secretPrefix?: string | undefined;
  readonly maxRetries?: number | undefined;
  readonly timeoutMs?: number | undefined;
  readonly circuitBreaker?: CircuitBreakerOptions | undefined;
}

interface CircuitBreakerState {
  consecutiveFailures: number;
  lastFailureTime: number;
}

export class AzureKeyVaultProvider implements SecretProvider {
  readonly name = "azure-keyvault";
  private readonly client: SecretClient;
  private readonly prefix: string | undefined;
  private readonly timeoutMs: number;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly breaker: CircuitBreakerState = { consecutiveFailures: 0, lastFailureTime: 0 };

  constructor(options: AzureKeyVaultProviderOptions) {
    this.client = new SecretClient(options.vaultUrl, options.credential, {
      ...(options.maxRetries !== undefined && { retryOptions: { maxRetries: options.maxRetries } }),
    });
    this.prefix = options.secretPrefix;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.failureThreshold = options.circuitBreaker?.failureThreshold ?? 5;
    this.cooldownMs = options.circuitBreaker?.cooldownMs ?? 30_000;
  }

  async resolve(ref: SecretReference): Promise<SecretValue> {
    this.assertCircuitClosed(ref.uri);
    try {
      const secret = await this.withTimeout(
        this.client.getSecret(this.prefixed(ref.uri), {
          ...(ref.version !== undefined && { version: ref.version }),
        }),
      );
      this.recordSuccess();
      return {
        value: secret.value ?? "",
        version: secret.properties.version,
        expiresAt: secret.properties.expiresOn,
      };
    } catch (err) {
      this.recordFailure();
      throw new SecretResolutionError(this.name, ref.uri, err);
    }
  }

  async store(uri: string, value: string): Promise<SecretStoreResult> {
    this.assertCircuitClosed(uri);
    try {
      const result = await this.withTimeout(
        this.client.setSecret(this.prefixed(uri), value),
      );
      this.recordSuccess();
      return { uri, version: result.properties.version ?? "" };
    } catch (err) {
      this.recordFailure();
      throw new SecretResolutionError(this.name, uri, err);
    }
  }

  async delete(uri: string): Promise<void> {
    this.assertCircuitClosed(uri);
    try {
      await this.withTimeout(this.client.beginDeleteSecret(this.prefixed(uri)));
      this.recordSuccess();
    } catch (err) {
      this.recordFailure();
      throw new SecretResolutionError(this.name, uri, err);
    }
  }

  async healthCheck(): Promise<SecretProviderHealth> {
    const start = Date.now();
    try {
      await this.client.getSecret("health-check-dummy");
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      if (isRestError(err) && err.statusCode === 404) {
        return { healthy: true, latencyMs };
      }
      return {
        healthy: false,
        latencyMs,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private assertCircuitClosed(uri: string): void {
    if (this.breaker.consecutiveFailures < this.failureThreshold) return;
    const elapsed = Date.now() - this.breaker.lastFailureTime;
    if (elapsed < this.cooldownMs) {
      throw new SecretResolutionError(
        this.name,
        uri,
        new Error(`Circuit breaker open: ${this.breaker.consecutiveFailures} consecutive failures`),
      );
    }
    // Cooldown elapsed — allow a probe attempt (half-open)
    this.breaker.consecutiveFailures = 0;
  }

  private recordSuccess(): void {
    this.breaker.consecutiveFailures = 0;
  }

  private recordFailure(): void {
    this.breaker.consecutiveFailures++;
    this.breaker.lastFailureTime = Date.now();
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Operation timed out")), this.timeoutMs);
      promise.then(
        (val) => { clearTimeout(timer); resolve(val); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }

  private prefixed(uri: string): string {
    return this.prefix ? `${this.prefix}-${uri}` : uri;
  }
}

function isRestError(err: unknown): err is { statusCode: number } {
  return (
    typeof err === "object" &&
    err !== null &&
    "statusCode" in err &&
    typeof (err as Record<string, unknown>)["statusCode"] === "number"
  );
}
