// @weaver/config-providers — Storage provider implementations (iteration 2)

export {
  type ConfigurationServiceOptions,
  createConfigurationService,
} from "./configuration-service.js";
export {
  createInMemoryStorageProvider,
  type InMemoryProviderOptions,
  InMemoryStorageProvider,
} from "./in-memory-provider.js";
export type { MountResolution } from "./mount-resolver.js";
export {
  buildMountMap,
  resolveMountedNamespace,
  resolveMountedValue,
} from "./mount-resolver.js";

export type { SecretIntegrationHandle, SecretIntegrationOptions } from "./secret-integration.js";
export { createSecretIntegration } from "./secret-integration.js";

export {
  createLocalStorageProvider,
  LocalStorageProvider,
  type LocalStorageProviderOptions,
} from "./local-storage-provider.js";
export {
  mergeWithEnvironment,
  withEnvironmentOverlay,
} from "./environment-overlay.js";
export type { EnvironmentOverlayOptions } from "./environment-overlay.js";
export { createScopeResolutionCache } from "./scope-resolution-cache.js";
export { createScopedConfigurationService } from "./scoped-service.js";
export {
  type ConfigurationStateContainer,
  createStateContainer,
} from "./state-container.js";
export {
  type StaticJsonProviderOptions,
  StaticJsonStorageProvider,
} from "./static-json-provider.js";
export { MemoryDurableConfigCacheAdapter } from "./sync/durable-cache-memory.js";
export { createViewConfigurationService } from "./view-service.js";
