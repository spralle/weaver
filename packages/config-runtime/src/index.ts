// Core orchestration
export { createConfigurationService } from "./configuration-service.js";
export type { ConfigurationServiceOptions } from "./configuration-service.js";

// State management
export { createStateContainer } from "./state-container.js";
export type { ConfigurationStateContainer } from "./state-container.js";

// Mounting
export { buildMountMap, resolveMountedValue, resolveMountedNamespace } from "./mount-resolver.js";
export type { MountResolution } from "./mount-resolver.js";

// Scoped services
export { createScopedConfigurationService } from "./scoped-service.js";
export { createViewConfigurationService } from "./view-service.js";
export { createScopeResolutionCache } from "./scope-resolution-cache.js";

// Secret integration
export { createSecretIntegration } from "./secret-integration.js";
export type { SecretIntegrationOptions, SecretIntegrationHandle } from "./secret-integration.js";

// Service configuration
export { createServiceConfigurationService } from "./service-configuration.js";
export type { ServiceConfigurationOptions } from "./service-configuration.js";
