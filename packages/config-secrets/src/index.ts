// @weaver-conf/config-secrets — Server-side secret resolution for Weaver

export type {
  AzureKeyVaultProvider,
  AzureKeyVaultProviderOptions,
  CircuitBreakerOptions,
} from "./azure-keyvault-provider";
export {
  createAzureKeyVaultProvider,
  SecretResolutionError,
} from "./azure-keyvault-provider";
export type {
  SecretCacheEntry,
  SecretCacheOptions,
} from "./secret-cache";
export { createSecretCache, SecretCache } from "./secret-cache";
export type {
  SecretMetadata,
  SecretProvider,
  SecretProviderHealth,
  SecretStoreResult,
  SecretValue,
} from "./secret-provider";
export type {
  SecretAuditLog,
  SecretResolutionFailure,
  SecretResolutionResult,
  SecretResolutionService,
  SecretResolutionServiceOptions,
} from "./secret-resolution-service";
export { createSecretResolutionService } from "./secret-resolution-service";
