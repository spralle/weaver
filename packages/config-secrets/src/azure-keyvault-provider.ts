import { SecretClient } from "@azure/keyvault-secrets";
import type { TokenCredential } from "@azure/identity";
import type { SecretReference } from "@weaver/config-types";
import type {
  SecretProvider,
  SecretProviderHealth,
  SecretStoreResult,
  SecretValue,
} from "./secret-provider.js";

export interface AzureKeyVaultProviderOptions {
  readonly vaultUrl: string;
  readonly credential: TokenCredential;
  readonly secretPrefix?: string | undefined;
  readonly maxRetries?: number | undefined;
}

export class AzureKeyVaultProvider implements SecretProvider {
  readonly name = "azure-keyvault";
  private readonly client: SecretClient;
  private readonly prefix: string | undefined;

  constructor(options: AzureKeyVaultProviderOptions) {
    this.client = new SecretClient(options.vaultUrl, options.credential, {
      ...(options.maxRetries !== undefined && { retryOptions: { maxRetries: options.maxRetries } }),
    });
    this.prefix = options.secretPrefix;
  }

  async resolve(ref: SecretReference): Promise<SecretValue> {
    const secret = await this.client.getSecret(this.prefixed(ref.uri), {
      ...(ref.version !== undefined && { version: ref.version }),
    });
    return {
      value: secret.value ?? "",
      version: secret.properties.version,
      expiresAt: secret.properties.expiresOn,
    };
  }

  async store(uri: string, value: string): Promise<SecretStoreResult> {
    const result = await this.client.setSecret(this.prefixed(uri), value);
    return {
      uri,
      version: result.properties.version ?? "",
    };
  }

  async delete(uri: string): Promise<void> {
    await this.client.beginDeleteSecret(this.prefixed(uri));
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
