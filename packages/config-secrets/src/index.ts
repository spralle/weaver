// @weaver-conf/config-secrets — Server-side secret resolution for Weaver

export type {
  AzureKeyVaultProvider,
  AzureKeyVaultProviderOptions,
  CircuitBreakerOptions,
} from "./azure-keyvault-provider.js";
export {
  createAzureKeyVaultProvider,
  SecretResolutionError,
} from "./azure-keyvault-provider.js";
export type {
  SecretCacheEntry,
  SecretCacheOptions,
} from "./secret-cache.js";
export { createSecretCache, SecretCache } from "./secret-cache.js";
export type {
  SecretMetadata,
  SecretProvider,
  SecretProviderHealth,
  SecretStoreResult,
  SecretValue,
} from "./secret-provider.js";
export type {
  SecretAuditLog,
  SecretResolutionFailure,
  SecretResolutionResult,
  SecretResolutionService,
  SecretResolutionServiceOptions,
} from "./secret-resolution-service.js";
export { createSecretResolutionService } from "./secret-resolution-service.js";
