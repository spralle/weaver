import type { SecretReference } from "@weaver/config-types";

/** A resolved secret value with optional version and expiration metadata. */
export interface SecretValue {
  readonly value: string;
  readonly version?: string | undefined;
  readonly expiresAt?: Date | undefined;
}

/** Metadata about a stored secret (provider, URI, timestamps). */
export interface SecretMetadata {
  readonly provider: string;
  readonly uri: string;
  readonly version?: string | undefined;
  readonly createdAt?: Date | undefined;
  readonly updatedAt?: Date | undefined;
  readonly expiresAt?: Date | undefined;
}

/** Result of storing a new secret — includes the assigned URI and version. */
export interface SecretStoreResult {
  readonly uri: string;
  readonly version: string;
}

/** Health check result for a secret provider backend. */
export interface SecretProviderHealth {
  readonly healthy: boolean;
  readonly latencyMs: number;
  readonly message?: string | undefined;
}

/** Pluggable secret backend that resolves, stores, and deletes secrets. */
export interface SecretProvider {
  readonly name: string;
  resolve(ref: SecretReference): Promise<SecretValue>;
  store(uri: string, value: string): Promise<SecretStoreResult>;
  delete(uri: string): Promise<void>;
  healthCheck(): Promise<SecretProviderHealth>;
}
