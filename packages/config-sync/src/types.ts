import type {
  ConfigSyncTransport,
  ConfigurationConflict,
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  SyncErrorCode,
  SyncErrorMetadata,
  SyncMutationQueue,
  SyncQueuedMutation,
  SyncResult,
  SyncSnapshotCache,
  SyncStatus,
} from "@weaver/config-types";

export interface SyncRetryPolicy {
  baseDelayMs?: number | undefined;
  maxDelayMs?: number | undefined;
}

export interface ConfigSyncOrchestratorOptions {
  snapshotCache: SyncSnapshotCache;
  mutationQueue: SyncMutationQueue;
  transport: ConfigSyncTransport;
  retryPolicy?: SyncRetryPolicy | undefined;
  conflictResolution?: "server-authoritative" | "lww-fallback" | undefined;
  batchSize?: number | undefined;
  now?: (() => number) | undefined;
  onSyncStateChange?: ((state: SyncStatus) => void) | undefined;
  onDiagnosticsChange?: ((diagnostics: SyncDiagnostics) => void) | undefined;
  /** Called after pull applies remote changes to the snapshot */
  onSnapshotChange?: ((snapshot: ConfigurationLayerData) => void) | undefined;
}

export interface SyncDiagnostics {
  pendingCount: number;
  lastSyncedAt?: number | undefined;
  lastError?:
    | {
        code: SyncErrorCode;
        message: string;
        retryable: boolean;
      }
    | undefined;
}

export interface ConfigSyncOrchestrator {
  load(): Promise<ConfigurationLayerData>;
  write(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  sync(): Promise<SyncResult>;
  triggerSync(): void;
  setOnline(isOnline: boolean): void;
  getSyncState(): SyncStatus;
  onSyncStateChange(listener: (state: SyncStatus) => void): () => void;
  getDiagnostics(): SyncDiagnostics;
  onDiagnosticsChange(
    listener: (diagnostics: SyncDiagnostics) => void,
  ): () => void;
  getPendingWrites(): ReadonlyMap<string, unknown>;
}

export interface SyncableConfigStorageProvider
  extends ConfigurationStorageProvider {
  readonly writable: true;
  readonly syncState: SyncStatus;
  readonly pendingWrites: ReadonlyMap<string, unknown>;
  sync(): Promise<SyncResult>;
  onSyncStateChange(listener: (state: SyncStatus) => void): () => void;
  getSyncDiagnostics(): SyncDiagnostics;
  onSyncDiagnosticsChange(
    listener: (diagnostics: SyncDiagnostics) => void,
  ): () => void;
}

export interface PushCycleResult {
  pushed: number;
  conflicts: ConfigurationConflict[];
}

export interface PushBatchOutcome {
  pushed: number;
  conflicts: ConfigurationConflict[];
  shouldStop: boolean;
  retryableError?: SyncErrorMetadata | undefined;
}

export interface LocalMutationContext {
  mutation: SyncQueuedMutation;
  localValue: unknown;
  localRevision?: string | undefined;
}
