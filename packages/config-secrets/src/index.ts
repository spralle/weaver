// @weaver/config-secrets — Server-side secret resolution for Weaver

export type {
  SecretValue,
  SecretMetadata,
  SecretStoreResult,
  SecretProviderHealth,
  SecretProvider,
} from "./secret-provider.js";

export type { SecretCacheOptions, SecretCacheEntry } from "./secret-cache.js";
export { createSecretCache, SecretCache } from "./secret-cache.js";

export type {
  SecretAuditLog,
  SecretResolutionServiceOptions,
  SecretResolutionFailure,
  SecretResolutionResult,
} from "./secret-resolution-service.js";
export { SecretResolutionService } from "./secret-resolution-service.js";

export type { AzureKeyVaultProviderOptions, CircuitBreakerOptions } from "./azure-keyvault-provider.js";
export { AzureKeyVaultProvider, SecretResolutionError } from "./azure-keyvault-provider.js";
