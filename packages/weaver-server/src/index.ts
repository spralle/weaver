// @weaver/weaver-server — Central configuration server

// types
export {
  weaverErrorCodes,
  weaverErrorCodeSchema,
  weaverErrorSchema,
  createWeaverError,
  HTTP_STATUS_MAP,
  httpStatusForError,
} from "./types/index.js";
export type { WeaverErrorCode, WeaverError } from "./types/index.js";
export { configDeltaSchema, configSnapshotSchema } from "./types/index.js";
export type { ConfigDelta, ConfigSnapshot } from "./types/index.js";
export {
  layerProviderSchema,
  bootstrapLayerSchema,
  bootstrapConfigSchema,
} from "./types/index.js";
export type {
  BootstrapConfig,
  BootstrapLayer,
  LayerProvider,
} from "./types/index.js";

// logger (from storage-provider-core)
export { consoleLogger } from "@weaver/storage-provider-core";
export type { WeaverLogger } from "@weaver/storage-provider-core";

// storage (from individual provider packages)
export { createGitManager } from "@weaver/storage-provider-git";
export type { GitManager, GitManagerOptions } from "@weaver/storage-provider-git";
export { createGitStorageProvider } from "@weaver/storage-provider-git";
export type { GitStorageProviderOptions } from "@weaver/storage-provider-git";
export { createMongoDBStorageProvider } from "@weaver/storage-provider-mongodb";
export type { MongoDBStorageProviderOptions } from "@weaver/storage-provider-mongodb";

// bootstrap
export { bootstrap } from "./bootstrap/index.js";
export type { BootstrapOptions, BootstrapResult } from "./bootstrap/index.js";
export { resolveEnvVars } from "./bootstrap/index.js";
export { createProviders, registerProviderFactory } from "./bootstrap/index.js";
export type { LayerFactoryDeps, ProviderFactory } from "./bootstrap/index.js";

// core
export { createWeaverConfigService } from "./core/index.js";
export type {
  WeaverConfigService,
  WeaverConfigServiceOptions,
  WriteContext,
} from "./core/index.js";
export { createChangeDetector } from "./core/index.js";
export type { ChangeDetector, ChangeDetectorOptions } from "./core/index.js";
export { createWebhookHandler } from "./core/index.js";
export type { WebhookHandler, WebhookHandlerOptions } from "./core/index.js";
export { createPromotionEngine } from "./core/index.js";
export type {
  PromotionEngine,
  PromotionEngineOptions,
  PromotionRequest,
  PromotionResult,
} from "./core/index.js";
export { createRollbackService } from "./core/index.js";
export type {
  RollbackService,
  RollbackServiceOptions,
  RollbackRequest,
  RollbackResult,
} from "./core/index.js";
export { createSchemaRegistry } from "./core/index.js";
export type {
  SchemaRegistry,
  SchemaRegistryOptions,
  SchemaRegistrationRequest,
  SchemaRegistrationResult,
} from "./core/index.js";
export { createScopeManager } from "./core/index.js";
export type {
  ScopeManager,
  ScopeManagerOptions,
  ProvisionScopeRequest,
  DeprovisionScopeRequest,
  ScopeProvisionResult,
} from "./core/index.js";
export {
  parseScopeLayer,
  isScopedLayer,
  buildScopePathString,
  parseScopeQuery,
} from "./core/index.js";
export { createSessionManager } from "./core/index.js";
export type {
  SessionManager,
  SessionManagerOptions,
  OverrideSessionRequest,
  OverrideSessionInfo,
} from "./core/index.js";

// transport
export { WEAVER_CONFIG_V1 } from "./transport/index.js";
export type { WeaverConfigContract } from "./transport/index.js";
export { createScompAdapter } from "./transport/index.js";
export type { ScompAdapter, ScompAdapterOptions } from "./transport/index.js";
export { createRestAdapter } from "./transport/index.js";
export type {
  RestAdapter,
  RestAdapterOptions,
  RestRequest,
  RestResponse,
  RestRoute,
} from "./transport/index.js";
export { createSSEAdapter } from "./transport/index.js";
export type {
  SSEAdapter,
  SSEAdapterOptions,
  SSEClient,
  SSEClientOptions,
} from "./transport/index.js";
export { formatSSEMessage } from "./transport/index.js";
export type {
  SSEMessage,
  SSEEventType,
  SSESnapshotEvent,
  SSEChangeEvent,
  SSECheckpointEvent,
} from "./transport/index.js";
export {
  sseSnapshotEventSchema,
  sseChangeEventSchema,
  sseCheckpointEventSchema,
} from "./transport/index.js";
export { matchGlob } from "./transport/index.js";
export {
  configWriteBodySchema,
  configBatchBodySchema,
  scopeProvisionBodySchema,
} from "./transport/index.js";

// auth
export {
  createJwtValidator,
  createAuthMiddleware,
} from "./auth/index.js";
export type {
  JwtIdentity,
  JwtValidator,
  JwtValidatorOptions,
  AuthContext,
  AuthMiddleware,
  AuthMiddlewareOptions,
} from "./auth/index.js";

// audit (from config-audit)
export { createAuditService } from "@weaver/config-audit";
export type {
  AuditService,
  AuditServiceOptions,
  ConfigAuditSink,
  SinkDomainAuditEntry,
} from "@weaver/config-audit";
export { createStdoutAuditSink } from "@weaver/config-audit";
export { createMongoAuditSink } from "@weaver/config-audit";
export type { MongoAuditSinkOptions, MongoCollection } from "@weaver/config-audit";

// health & shutdown
export { createHealthEndpoints } from "./health.js";
export type { HealthEndpoints, HealthStatus } from "./health.js";
export { createShutdownManager } from "./shutdown.js";
export type { ShutdownManager, ShutdownManagerOptions } from "./shutdown.js";

// server
export { startWeaverServer } from "./server.js";
export type { WeaverServer, WeaverServerOptions } from "./server.js";
