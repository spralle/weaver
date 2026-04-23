// @weaver/config-types — Configuration type definitions and Zod schemas

// access.ts — Permission types and default policies
export type {
  ConfigurationAccessContext,
  LayerWriteConstraint,
  LayerWritePolicy,
  ServiceConfigurationDeclaration,
} from "./access.js";
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
// merge-types.ts — Merge function type
export type { MergeFunction } from "./merge-types.js";
// promotion-types.ts — Promotion pipeline, audit, and emergency override types
export type {
  ConfigAuditEntry,
  EmergencyOverrideRecord,
  PromotionRequest,
  PromotionStatus,
} from "./promotion-types.js";
// property-schema.ts — Property schema and policy types
export type {
  ConfigChangePolicy,
  ConfigReloadBehavior,
  ConfigurationJsonSchemaType,
  ConfigurationPropertySchema,
  ConfigurationRole,
  ConfigurationVisibility,
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
// schemas-core.ts — Zod schemas for core types
export {
  configChangePolicySchema,
  configReloadBehaviorSchema,
  configurationAccessContextSchema,
  configurationContextSchema,
  configurationLayerDataSchema,
  configurationLayerEntrySchema,
  configurationLayerSchema,
  configurationLayerStackSchema,
  configurationPropertySchemaSchema,
  configurationRoleSchema,
  configurationVisibilitySchema,
  expressionValidationResultSchema,
  godModeSessionSchema,
  layerWriteConstraintSchema,
  layerWritePolicySchema,
  overrideSessionSchema,
  propertySessionModeSchema,
  scopeDefinitionSchema,
  scopeInstanceSchema,
  serviceConfigurationDeclarationSchema,
  sessionActivationRequestSchema,
  sessionDeactivationResultSchema,
  sessionLayerMetadataSchema,
  sessionModeSchema,
  sessionTypeSchema,
  tenantScopeHierarchySchema,
} from "./schemas-core.js";
// schemas-promotion.ts — Zod schemas for promotion types
export {
  configAuditEntrySchema,
  emergencyOverrideRecordSchema,
  promotionRequestSchema,
  promotionStatusSchema,
} from "./schemas-promotion.js";
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
  ScopeInstance,
  TenantScopeHierarchy,
} from "./types.js";
// view-config-declaration.ts — View config declaration type and factory
export type { ViewConfigDeclaration } from "./view-config-declaration.js";
export { defineViewConfig } from "./view-config-declaration.js";

// weaver.ts — defineWeaver() builder
export type { ExtractLayerNames, WeaverConfig } from "./weaver.js";
export { defineWeaver } from "./weaver.js";
