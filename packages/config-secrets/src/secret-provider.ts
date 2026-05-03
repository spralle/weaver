import type { SecretReference } from "@weaver/config-types";

export interface SecretValue {
  readonly value: string;
  readonly version?: string | undefined;
  readonly expiresAt?: Date | undefined;
}

export interface SecretMetadata {
  readonly provider: string;
  readonly uri: string;
  readonly version?: string | undefined;
  readonly createdAt?: Date | undefined;
  readonly updatedAt?: Date | undefined;
  readonly expiresAt?: Date | undefined;
}

export interface SecretStoreResult {
  readonly uri: string;
  readonly version: string;
}

export interface SecretProviderHealth {
  readonly healthy: boolean;
  readonly latencyMs: number;
  readonly message?: string | undefined;
}

export interface SecretProvider {
  readonly name: string;
  resolve(ref: SecretReference): Promise<SecretValue>;
  store(uri: string, value: string): Promise<SecretStoreResult>;
  delete(uri: string): Promise<void>;
  healthCheck(): Promise<SecretProviderHealth>;
}
