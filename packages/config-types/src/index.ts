// @weaver/config-types — Configuration type definitions and Zod schemas

// types.ts — Layer, context, and stack types
export type {
  ConfigurationLayer,
  ScopeDefinition,
  ScopeInstance,
  TenantScopeHierarchy,
  ConfigurationContext,
  ConfigurationLayerEntry,
  ConfigurationLayerStack,
  ConfigurationLayerData,
} from "./types.js";

// property-schema.ts — Property schema and policy types
export type {
  ConfigChangePolicy,
  ConfigurationVisibility,
  ConfigurationRole,
  ConfigReloadBehavior,
  ConfigurationJsonSchemaType,
  ConfigurationPropertySchema,
} from "./property-schema.js";

// service.ts — Service interfaces
export type {
  ConfigurationSessionHandle,
  ConfigurationInspection,
  ConfigurationService,
  ScopedConfigurationService,
  ViewConfigurationService,
  ServiceConfigurationService,
} from "./service.js";

// providers.ts — Storage provider interfaces
export type {
  WriteResult,
  ConfigurationChange,
  ConfigurationStorageProvider,
  SyncStatus,
  ConfigurationConflict,
  SyncResult,
  SyncCursor,
  SyncQueueMetadata,
  SyncMutationOperation,
  SyncMutationMetadata,
  SyncQueuedMutation,
  SyncRemoteChange,
  SyncErrorCode,
  SyncErrorMetadata,
  SyncConflictMetadata,
  ConfigSyncPullRequest,
  ConfigSyncPullResponse,
  ConfigSyncPushRequest,
  ConfigSyncPushResult,
  ConfigSyncPushResponse,
  ConfigSyncAckRequest,
  ConfigSyncAckResponse,
  SyncSnapshotCache,
  SyncMutationQueue,
  DurableConfigCache,
  ConfigSyncTransport,
} from "./providers.js";

// expressions.ts — Expression evaluator interface
export type {
  ExpressionValidationResult,
  ExpressionEvaluatorProvider,
} from "./expressions.js";

// session.ts — Session layer types
export type {
  SessionType,
  SessionMode,
  PropertySessionMode,
  SessionLayerMetadata,
  SessionLayer,
  OverrideSession,
  GodModeSession,
  SessionActivationRequest,
  SessionDeactivationResult,
} from "./session.js";

// access.ts — Permission types and default policies
export type {
  ConfigurationAccessContext,
  LayerWriteConstraint,
  LayerWritePolicy,
  ServiceConfigurationDeclaration,
} from "./access.js";

// schemas-core.ts — Zod schemas for core types
export {
  configurationLayerSchema,
  scopeDefinitionSchema,
  scopeInstanceSchema,
  tenantScopeHierarchySchema,
  configurationContextSchema,
  configurationLayerEntrySchema,
  configurationLayerStackSchema,
  configurationLayerDataSchema,
  configChangePolicySchema,
  configurationVisibilitySchema,
  configurationRoleSchema,
  configReloadBehaviorSchema,
  configurationPropertySchemaSchema,
  expressionValidationResultSchema,
  sessionTypeSchema,
  sessionModeSchema,
  propertySessionModeSchema,
  sessionLayerMetadataSchema,
  overrideSessionSchema,
  godModeSessionSchema,
  sessionActivationRequestSchema,
  sessionDeactivationResultSchema,
  configurationAccessContextSchema,
  layerWriteConstraintSchema,
  layerWritePolicySchema,
  serviceConfigurationDeclarationSchema,
} from "./schemas-core.js";

// schemas-providers.ts — Zod schemas for provider types
export {
  writeResultSchema,
  configurationChangeSchema,
  configurationConflictSchema,
  syncResultSchema,
  syncQueueMetadataSchema,
  syncStatusSyncedSchema,
  syncStatusSyncingSchema,
  syncStatusOfflineSchema,
  syncStatusConflictSchema,
  syncStatusErrorSchema,
  syncStatusSchema,
  configurationInspectionSchema,
} from "./schemas-providers.js";

// type-utils.ts — Compile-time mapped types for typesafe config access
export type {
  ConfigKeyPath,
  ConfigValueAtPath,
  TypedConfigurationService,
} from "./type-utils.js";

// view-config-declaration.ts — View config declaration type and factory
export type { ViewConfigDeclaration } from "./view-config-declaration.js";
export { defineViewConfig } from "./view-config-declaration.js";

// promotion-types.ts — Promotion pipeline, audit, and emergency override types
export type {
  PromotionStatus,
  PromotionRequest,
  ConfigAuditEntry,
  EmergencyOverrideRecord,
} from "./promotion-types.js";

// schemas-promotion.ts — Zod schemas for promotion types
export {
  promotionStatusSchema,
  promotionRequestSchema,
  configAuditEntrySchema,
  emergencyOverrideRecordSchema,
} from "./schemas-promotion.js";

// cache.ts — Scope resolution cache interface
export type { ScopeResolutionCache } from "./cache.js";
export { serializeScopePath } from "./cache.js";

// merge-types.ts — Merge function type
export type { MergeFunction } from "./merge-types.js";

// layers.ts — Layer abstraction interfaces
export type {
  ResolutionContext,
  LayerData,
  LayerResolver,
  LayerType,
  LayerDefinition,
  StaticLayerConfig,
  DynamicLayerConfig,
  PersonalLayerConfig,
  EphemeralLayerConfig,
} from "./layers.js";

// layer-factories.ts — Built-in layer factories
export { Layers, replaceOnly } from "./layer-factories.js";

// weaver.ts — defineWeaver() builder
export type { ExtractLayerNames, WeaverConfig } from "./weaver.js";
export { defineWeaver } from "./weaver.js";
