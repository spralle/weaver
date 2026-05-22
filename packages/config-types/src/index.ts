// @weaver-conf/config-types — Configuration type definitions and Zod schemas

// result.ts — Discriminated Result<T,E> union for fallible operations
export type { Result } from "./result.js";
export { ok, err, isOk, isErr } from "./result.js";

// access.ts — Permission types and default policies
export type {
  ConfigurationAccessContext,
  ConfigurationSchemaFragment,
  LayerWriteConstraint,
  LayerWritePolicy,
  ServiceAccessPolicy,
  ServiceConfigurationDeclaration,
} from "./access.js";
// cache.ts — Scope resolution cache interface
export type { ScopeResolutionCache } from "./cache.js";
export { serializeScopePath } from "./cache.js";
// environment.ts — Environment-aware provider types and provenance tracking
export type {
  ConfigValueSource,
  EnvironmentAwareStorageProvider,
  EnvironmentName,
  LayerValueDetail,
  MergedLayerResult,
} from "./environment.js";
export type { WeaverError, WeaverErrorCode } from "./errors.js";
// errors.ts — Shared error taxonomy
export {
  createWeaverError,
  WeaverErrorInstance,
  weaverErrorCodeSchema,
  weaverErrorCodes,
  weaverErrorSchema,
} from "./errors.js";
// expressions.ts — Expression evaluator interface
export type {
  ExpressionEvaluatorProvider,
  ExpressionValidationResult,
} from "./expressions.js";
// layer-factories.ts — Built-in layer factories
export { Layers, replaceOnly } from "./layer-factories.js";
// layers.ts — Layer abstraction interfaces
export type {
  DynamicLayerConfig,
  EphemeralLayerConfig,
  LayerData,
  LayerDefinition,
  LayerResolver,
  LayerType,
  PersonalLayerConfig,
  ResolutionContext,
  StaticLayerConfig,
} from "./layers.js";
// markers.ts — _weaver marker types and type guards
export type { ConfigMount, SecretReference, WeaverMarker } from "./markers.js";
export { isConfigMount, isSecretReference, isWeaverMarker } from "./markers.js";
// merge-types.ts — Merge function type
export type { MergeFunction } from "./merge-types.js";
// promotion-types.ts — Promotion pipeline, audit, and emergency override types
export type {
  AuditEntryBase,
  ConfigAuditEntry,
  ConfigDomainAuditEntry,
  EmergencyOverrideRecord,
  PromotionRequest,
  PromotionStatus,
  SecretDomainAuditEntry,
  SessionDomainAuditEntry,
  SinkDomainAuditEntry,
} from "./promotion-types.js";
// property-schema.ts — Property schema and policy types
export type {
  ConfigChangePolicy,
  ConfigReloadBehavior,
  ConfigurationJsonSchemaType,
  ConfigurationPropertySchema,
  ConfigurationRole,
  ConfigurationVisibility,
  WeaverPropertyExtensions,
} from "./property-schema.js";
// providers.ts — Storage provider interfaces
export type {
  ConfigSyncAckRequest,
  ConfigSyncAckResponse,
  ConfigSyncPullRequest,
  ConfigSyncPullResponse,
  ConfigSyncPushRequest,
  ConfigSyncPushResponse,
  ConfigSyncPushResult,
  ConfigSyncTransport,
  ConfigurationChange,
  ConfigurationConflict,
  ConfigurationStorageProvider,
  DurableConfigCache,
  SyncConflictMetadata,
  SyncCursor,
  SyncErrorCode,
  SyncErrorMetadata,
  SyncMutationMetadata,
  SyncMutationOperation,
  SyncMutationQueue,
  SyncQueuedMutation,
  SyncQueueMetadata,
  SyncRemoteChange,
  SyncResult,
  SyncSnapshotCache,
  SyncStatus,
  WriteResult,
} from "./providers.js";
// schemas-access.ts — Zod schemas for access context and write policy types
export {
  configurationAccessContextSchema,
  configurationSchemaFragmentSchema,
  layerWriteConstraintSchema,
  layerWritePolicySchema,
  serviceAccessPolicySchema,
  serviceConfigurationDeclarationSchema,
} from "./schemas-access.js";
export type {
  BootstrapConfig,
  BootstrapLayer,
  LayerProvider,
} from "./schemas-bootstrap.js";
// schemas-bootstrap.ts — Zod schemas for bootstrap configuration
export {
  bootstrapConfigSchema,
  bootstrapLayerSchema,
  builtinProviders,
  layerProviderSchema,
} from "./schemas-bootstrap.js";
// schemas-expression.ts — Zod schemas for expression validation types
export { expressionValidationResultSchema } from "./schemas-expression.js";
// schemas-layers.ts — Zod schemas for layer and context types
export {
  configurationContextSchema,
  configurationLayerDataSchema,
  configurationLayerEntrySchema,
  configurationLayerSchema,
  configurationLayerStackSchema,
  scopeDefinitionSchema,
  scopeHierarchySchema,
  scopeInstanceSchema,
  tenantScopeHierarchySchema,
} from "./schemas-layers.js";
// schemas-markers.ts — Zod schemas for marker types
export {
  configMountSchema,
  secretReferenceSchema,
  weaverMarkerSchema,
} from "./schemas-markers.js";
// schemas-policy.ts — Zod schemas for change policy, visibility, and role types
export {
  configChangePolicySchema,
  configReloadBehaviorSchema,
  configurationJsonSchemaTypeSchema,
  configurationRoleSchema,
  configurationVisibilitySchema,
  propertySessionModeSchema,
  weaverPropertyExtensionsSchema,
} from "./schemas-policy.js";
// schemas-promotion.ts — Zod schemas for promotion types
export {
  configAuditEntrySchema,
  configDomainAuditEntrySchema,
  emergencyOverrideRecordSchema,
  promotionRequestSchema,
  promotionStatusSchema,
  secretDomainAuditEntrySchema,
  sessionDomainAuditEntrySchema,
  sinkDomainAuditEntrySchema,
} from "./schemas-promotion.js";
// schemas-property.ts — Zod schemas for configuration property schema types
export { configurationPropertySchemaSchema } from "./schemas-property.js";
// schemas-providers.ts — Zod schemas for provider types
export {
  configurationChangeSchema,
  configurationConflictSchema,
  configurationInspectionSchema,
  syncQueueMetadataSchema,
  syncResultSchema,
  syncStatusConflictSchema,
  syncStatusErrorSchema,
  syncStatusOfflineSchema,
  syncStatusSchema,
  syncStatusSyncedSchema,
  syncStatusSyncingSchema,
  writeResultSchema,
} from "./schemas-providers.js";
// schemas-session.ts — Zod schemas for session types
export {
  godModeSessionSchema,
  overrideSessionSchema,
  sessionActivationRequestSchema,
  sessionDeactivationResultSchema,
  sessionLayerMetadataSchema,
  sessionModeSchema,
  sessionTypeSchema,
} from "./schemas-session.js";
export type { ConfigDelta, ConfigSnapshot } from "./schemas-transport.js";
// schemas-transport.ts — Zod schemas for transport types (ConfigDelta, ConfigSnapshot)
export {
  configDeltaSchema,
  configSnapshotSchema,
} from "./schemas-transport.js";
// service.ts — Service interfaces
export type {
  ConfigurationInspection,
  ConfigurationService,
  ConfigurationSessionHandle,
  ScopedConfigurationService,
  ServiceConfigurationService,
  ViewConfigurationService,
} from "./service.js";
// session.ts — Session layer types
export type {
  GodModeSession,
  OverrideSession,
  PropertySessionMode,
  SessionActivationRequest,
  SessionDeactivationResult,
  SessionLayer,
  SessionLayerMetadata,
  SessionMode,
  SessionType,
} from "./session.js";
// type-utils.ts — Compile-time mapped types for typesafe config access
export type {
  ConfigKeyPath,
  ConfigValueAtPath,
  TypedConfigurationService,
} from "./type-utils.js";
// types.ts — Layer, context, and stack types
export type {
  ConfigurationContext,
  ConfigurationLayer,
  ConfigurationLayerData,
  ConfigurationLayerEntry,
  ConfigurationLayerStack,
  ScopeDefinition,
  ScopeHierarchy,
  ScopeInstance,
  TenantScopeHierarchy,
} from "./types.js";
// view-config-declaration.ts — View config declaration type and factory
export type { ViewConfigDeclaration } from "./view-config-declaration.js";
export { defineViewConfig } from "./view-config-declaration.js";
// weaver.ts — defineWeaver() builder
export type { ExtractLayerNames, WeaverConfig } from "./weaver.js";
export { defineWeaver } from "./weaver.js";
