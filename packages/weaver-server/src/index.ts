// @weaver/weaver-server — Central configuration server

export type { WeaverLogger } from "@weaver/config-engine";
export { consoleLogger } from "@weaver/config-engine";
export type {
  AuditService,
  AuditServiceOptions,
} from "./audit/audit-service.js";
export { createAuditService } from "./audit/audit-service.js";
export { createFileSystemAuditLog } from "./audit/fs-audit-log.js";
export { createInMemoryAuditLog } from "./audit/memory-audit-log.js";
export type {
  MongoAuditSinkOptions,
  MongoCollection,
} from "./audit/mongo-sink.js";
export { createMongoAuditSink } from "./audit/mongo-sink.js";
export { createStdoutAuditSink } from "./audit/stdout-sink.js";
export type {
  ConfigAuditEntry,
  ConfigAuditLog,
  ConfigAuditSink,
  ConfigDomainAuditEntry,
  SinkDomainAuditEntry,
} from "./audit/types.js";
export type {
  AuthContext,
  AuthMiddleware,
  AuthMiddlewareOptions,
  JwtIdentity,
  JwtValidator,
  JwtValidatorOptions,
} from "./auth/index.js";
// auth
export {
  createAuthMiddleware,
  createJwtValidator,
} from "./auth/index.js";
export type {
  BootstrapOptions,
  BootstrapResult,
  LayerFactoryDeps,
  ProviderFactory,
} from "./bootstrap/index.js";
// bootstrap
export {
  bootstrap,
  createProviders,
  registerProviderFactory,
  resolveEnvVars,
} from "./bootstrap/index.js";
export type {
  ChangeDetector,
  ChangeDetectorOptions,
  DeprovisionScopeRequest,
  OverrideSessionInfo,
  OverrideSessionRequest,
  PromotionEngine,
  PromotionEngineOptions,
  PromotionRequest,
  PromotionResult,
  ProvisionScopeRequest,
  RollbackRequest,
  RollbackResult,
  RollbackService,
  RollbackServiceOptions,
  SchemaRegistrationRequest,
  SchemaRegistrationResult,
  SchemaRegistry,
  SchemaRegistryOptions,
  ScopeManager,
  ScopeManagerOptions,
  ScopeProvisionResult,
  SessionManager,
  SessionManagerOptions,
  WeaverConfigService,
  WeaverConfigServiceOptions,
  WebhookHandler,
  WebhookHandlerOptions,
  WriteContext,
} from "./core/index.js";
// core
export {
  buildScopePathString,
  createChangeDetector,
  createPromotionEngine,
  createRollbackService,
  createSchemaRegistry,
  createScopeManager,
  createSessionManager,
  createWeaverConfigService,
  createWebhookHandler,
  isScopedLayer,
  parseScopeLayer,
  parseScopeQuery,
} from "./core/index.js";
export type { HealthEndpoints, HealthStatus } from "./health.js";
// health & shutdown
export { createHealthEndpoints } from "./health.js";
// providers
export type {
  FileSystemProviderOptions,
  FileSystemStorageProvider,
} from "./providers/fs-provider.js";
export { createFileSystemStorageProvider } from "./providers/fs-provider.js";
export type { InMemoryProviderOptions } from "./providers/in-memory-provider.js";
export { createInMemoryStorageProvider } from "./providers/in-memory-provider.js";
export type {
  EnvironmentOverlayOptions,
  GitManager,
  GitManagerOptions,
  GitStorageProviderOptions,
} from "./providers/index.js";
export {
  createGitManager,
  createGitStorageProvider,
  mergeWithEnvironment,
  withEnvironmentOverlay,
} from "./providers/index.js";
export type { MongoDBStorageProviderOptions } from "./providers/mongodb-storage-provider.js";
export { createMongoDBStorageProvider } from "./providers/mongodb-storage-provider.js";
export type { WeaverServer, WeaverServerOptions } from "./server.js";
// server
export { startWeaverServer } from "./server.js";
export type { ServerEnv } from "./server-env.js";
export { parseServerEnv, serverEnvSchema } from "./server-env.js";
export type { ShutdownManager, ShutdownManagerOptions } from "./shutdown.js";
export { createShutdownManager } from "./shutdown.js";
export type {
  RestAdapter,
  RestAdapterOptions,
  RestRequest,
  RestResponse,
  RestRoute,
  ScompAdapter,
  ScompAdapterOptions,
  SSEAdapter,
  SSEAdapterOptions,
  SSEChangeEvent,
  SSECheckpointEvent,
  SSEClient,
  SSEClientOptions,
  SSEEventType,
  SSEMessage,
  SSESnapshotEvent,
  WeaverConfigContract,
} from "./transport/index.js";
// transport
export {
  configBatchBodySchema,
  configWriteBodySchema,
  createRestAdapter,
  createScompAdapter,
  createSSEAdapter,
  formatSSEMessage,
  matchGlob,
  scopeProvisionBodySchema,
  sseChangeEventSchema,
  sseCheckpointEventSchema,
  sseSnapshotEventSchema,
  WEAVER_CONFIG_V1,
} from "./transport/index.js";
export type {
  BootstrapConfig,
  BootstrapLayer,
  ConfigDelta,
  ConfigSnapshot,
  LayerProvider,
  WeaverError,
  WeaverErrorCode,
} from "./types/index.js";
// types
export {
  bootstrapConfigSchema,
  bootstrapLayerSchema,
  configDeltaSchema,
  configSnapshotSchema,
  createWeaverError,
  HTTP_STATUS_MAP,
  httpStatusForError,
  layerProviderSchema,
  weaverErrorCodeSchema,
  weaverErrorCodes,
  weaverErrorSchema,
} from "./types/index.js";
