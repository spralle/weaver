// @weaver/weaver-server — Central configuration server

export type {
  AuditService,
  AuditServiceOptions,
  ConfigAuditSink,
  MongoAuditSinkOptions,
  MongoCollection,
  SinkDomainAuditEntry,
} from "@weaver/config-audit";
// audit (from config-audit)
export {
  createAuditService,
  createMongoAuditSink,
  createStdoutAuditSink,
} from "@weaver/config-audit";
export type { WeaverLogger } from "@weaver/storage-provider-core";

// logger (from storage-provider-core)
export { consoleLogger } from "@weaver/storage-provider-core";
export type {
  GitManager,
  GitManagerOptions,
  GitStorageProviderOptions,
} from "@weaver/storage-provider-git";
// storage (from individual provider packages)
export {
  createGitManager,
  createGitStorageProvider,
} from "@weaver/storage-provider-git";
export type { MongoDBStorageProviderOptions } from "@weaver/storage-provider-mongodb";
export { createMongoDBStorageProvider } from "@weaver/storage-provider-mongodb";
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
