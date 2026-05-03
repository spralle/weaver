// @weaver/config-secrets — Server-side secret resolution for Weaver

export type {
  SecretValue,
  SecretMetadata,
  SecretStoreResult,
  SecretProviderHealth,
  SecretProvider,
} from "./secret-provider.js";

export type { SecretCacheOptions, SecretCacheEntry } from "./secret-cache.js";
export { createSecretCache } from "./secret-cache.js";
export type { SecretCache } from "./secret-cache.js";

export type {
  SecretAuditLog,
  SecretResolutionServiceOptions,
  SecretResolutionFailure,
  SecretResolutionResult,
} from "./secret-resolution-service.js";
export { createSecretResolutionService } from "./secret-resolution-service.js";
export type { SecretResolutionService } from "./secret-resolution-service.js";

export type { AzureKeyVaultProviderOptions, CircuitBreakerOptions } from "./azure-keyvault-provider.js";
export { createAzureKeyVaultProvider, SecretResolutionError } from "./azure-keyvault-provider.js";
export type { AzureKeyVaultProvider } from "./azure-keyvault-provider.js";
