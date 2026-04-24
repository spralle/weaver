// @weaver/config-providers — Storage provider implementations (iteration 2)

export {
  type ConfigurationServiceOptions,
  createConfigurationService,
} from "./configuration-service.js";
export {
  type InMemoryProviderOptions,
  InMemoryStorageProvider,
} from "./in-memory-provider.js";

export {
  LocalStorageProvider,
  type LocalStorageProviderOptions,
} from "./local-storage-provider.js";
export { createScopedConfigurationService } from "./scoped-service.js";
export {
  type ConfigurationStateContainer,
  createStateContainer,
} from "./state-container.js";
export {
  type StaticJsonProviderOptions,
  StaticJsonStorageProvider,
} from "./static-json-provider.js";
export { createScopeResolutionCache } from "./scope-resolution-cache.js";
export { MemoryDurableConfigCacheAdapter } from "./sync/durable-cache-memory.js";
export { createViewConfigurationService } from "./view-service.js";
