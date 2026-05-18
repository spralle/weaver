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
  ConfigDelta,
  ConfigSnapshot,
  ConfigurationInspection,
  GetOptions,
  ResolveOptions,
  Unsubscribe,
} from "./types.js";
