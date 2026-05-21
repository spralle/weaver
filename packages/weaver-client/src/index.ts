export type { WeaverClient, WeaverClientOptions } from "./client.js";
export { createWeaverClient } from "./client.js";
export { flattenObject } from "./flatten.js";
export type { FileSystemPersistenceOptions } from "./fs-persistence.js";
export { createFileSystemPersistence } from "./fs-persistence.js";
export type { HttpTransportOptions } from "./http-transport.js";
export { createHttpTransport } from "./http-transport.js";
export type { IndexedDbPersistenceOptions } from "./indexeddb-persistence.js";
export { createIndexedDbPersistence } from "./indexeddb-persistence.js";
export type {
  LocalTransport,
  LocalTransportOptions,
} from "./local-transport.js";
export { createLocalTransport } from "./local-transport.js";
export type { WeaverClientPersistence } from "./persistence.js";
export type {
  ScopeLoader,
  ScopeLoaderOptions,
  ScopeLoadingMode,
} from "./scope-manager.js";
export { createScopeLoader } from "./scope-manager.js";
export type { StalenessConfig, StalenessMonitor } from "./staleness.js";
export { createStalenessMonitor } from "./staleness.js";
export {
  createSyncRuntimeBridge,
  type SyncRuntimeBridge,
  type SyncRuntimeBridgeOptions,
} from "./sync-runtime-bridge.js";
export { createWeaverSyncTransport } from "./sync-transport-adapter.js";
export type {
  WeaverTransport,
  WriteOptions,
  WriteResult,
} from "./transport.js";
export type {
  ClientLayerInspection,
  ClientMode,
  ConfigDelta,
  ConfigSnapshot,
  ConfigurationInspection,
  GetOptions,
  ResolveOptions,
  SchemaOptions,
  Unsubscribe,
} from "./types.js";
export type { ClientSchemaRegistry, ValidationResult } from "./schema-registry.js";
export { createClientSchemaRegistry } from "./schema-registry.js";
export type { ValidationOptions } from "./validation.js";
export { validateOnRead, validateOnWrite } from "./validation.js";
export type {
  InstanceClient,
  NamespaceDefinition,
  TypedInstanceClient,
  TypedNamespaceClient,
  UntypedNamespaceClient,
} from "./namespace.js";
export { defineNamespace } from "./namespace.js";
export type { InstanceClientDeps } from "./instance-client.js";
export { createInstanceClient } from "./instance-client.js";
export type { NamespaceClientDeps } from "./typed-namespace-client.js";
export { createTypedNamespaceClient } from "./typed-namespace-client.js";
