// Re-export storage providers from dedicated package

export type {
  FileSystemProviderOptions,
  FileSystemStorageProvider,
  GitManager,
  GitManagerOptions,
  GitOperationResult,
  GitStorageProviderOptions,
  InMemoryProviderOptions,
  MongoDBStorageProviderOptions,
} from "@weaver-conf/storage-providers";
export {
  createFileSystemStorageProvider,
  createGitManager,
  createGitStorageProvider,
  createInMemoryStorageProvider,
  createMongoDBStorageProvider,
} from "@weaver-conf/storage-providers";

// Server-specific orchestration
export type { EnvironmentOverlayOptions } from "./environment-overlay";
export {
  mergeWithEnvironment,
  withEnvironmentOverlay,
} from "./environment-overlay";
