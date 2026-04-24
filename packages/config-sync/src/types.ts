import type {
  ConfigSyncTransport,
  ConfigurationChange,
  ConfigurationConflict,
  ConfigurationLayer,
  ConfigurationLayerData,
  SyncErrorCode,
  SyncErrorMetadata,
  SyncMutationQueue,
  SyncQueuedMutation,
  SyncResult,
  SyncSnapshotCache,
  SyncStatus,
  WriteResult,
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

export interface SyncableConfigStorageProvider {
  readonly id: string;
  readonly layer: ConfigurationLayer | string;
  readonly writable: true;
  load(): Promise<ConfigurationLayerData>;
  write(key: string, value: unknown): Promise<WriteResult>;
  remove(key: string): Promise<WriteResult>;
  onExternalChange?(
    listener: (changes: ConfigurationChange[]) => void,
  ): () => void;
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
