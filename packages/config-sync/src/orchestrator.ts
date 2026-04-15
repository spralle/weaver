import type { ConfigurationLayerData, SyncResult, SyncStatus } from "@weaver/config-types";
import {
  classifySyncError,
  cloneSnapshot,
  createMutation,
  flushQueue,
  pullChanges,
} from "./internal/orchestrator-ops.js";
import { calculateRetryDelay, scheduleRetryState } from "./internal/retry-policy.js";
import type {
  ConfigSyncOrchestrator,
  ConfigSyncOrchestratorOptions,
  LocalMutationContext,
  SyncDiagnostics,
} from "./types.js";

// Timer helpers — avoids dependency on DOM or @types/node lib for setTimeout/clearTimeout
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(id: unknown): void;

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_RETRY_BASE_MS = 500;
const DEFAULT_RETRY_MAX_MS = 30_000;

export function createConfigSyncOrchestrator(options: ConfigSyncOrchestratorOptions): ConfigSyncOrchestrator {
  return new ConfigSyncOrchestratorImpl(options);
}

class ConfigSyncOrchestratorImpl implements ConfigSyncOrchestrator {
  private readonly snapshotCache: ConfigSyncOrchestratorOptions["snapshotCache"];
  private readonly mutationQueue: ConfigSyncOrchestratorOptions["mutationQueue"];
  private readonly transport: ConfigSyncOrchestratorOptions["transport"];
  private readonly batchSize: number;
  private readonly retryBaseMs: number;
  private readonly retryMaxMs: number;
  private readonly conflictResolution: "server-authoritative" | "lww-fallback";
  private readonly now: () => number;
  private readonly options: ConfigSyncOrchestratorOptions;
  private readonly pendingWrites = new Map<string, unknown>();
  private readonly revisions = new Map<string, string>();
  private readonly localContext = new Map<string, LocalMutationContext>();
  private readonly syncStateListeners = new Set<(state: SyncStatus) => void>();
  private readonly diagnosticsListeners = new Set<(diagnostics: SyncDiagnostics) => void>();

  private syncState: SyncStatus = { status: "syncing" };
  private diagnostics: SyncDiagnostics = { pendingCount: 0 };
  private queueMeta: { pendingCount: number; inFlightCount: number } = { pendingCount: 0, inFlightCount: 0 };

  private snapshot: ConfigurationLayerData = { entries: {} };
  private online = true;
  private loaded = false;
  private syncInFlight: Promise<SyncResult> | undefined;
  private retryTimer: unknown = undefined;
  private retryAttempt = 0;
  private mutationCounter = 0;
  private readonly instanceId: string;

  constructor(options: ConfigSyncOrchestratorOptions) {
    this.options = options;
    this.snapshotCache = options.snapshotCache;
    this.mutationQueue = options.mutationQueue;
    this.transport = options.transport;
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.retryBaseMs = options.retryPolicy?.baseDelayMs ?? DEFAULT_RETRY_BASE_MS;
    this.retryMaxMs = options.retryPolicy?.maxDelayMs ?? DEFAULT_RETRY_MAX_MS;
    this.conflictResolution = options.conflictResolution ?? "server-authoritative";
    this.now = options.now ?? (() => Date.now());
    this.instanceId = Math.random().toString(36).slice(2, 8);
  }

  async load(): Promise<ConfigurationLayerData> {
    this.snapshot = await this.snapshotCache.loadSnapshot();
    this.loaded = true;
    const queue = await this.mutationQueue.getQueueMetadata();
    this.setQueue(queue);
    this.updateDiagnostics({ pendingCount: queue.pendingCount, lastSyncedAt: this.snapshot.lastSyncedAt });

    if (!this.online) {
      this.setSyncState({
        status: "offline",
        lastSyncedAt: this.snapshot.lastSyncedAt ?? 0,
        pendingWriteCount: this.getPendingWriteCount(),
      });
      return cloneSnapshot(this.snapshot);
    }

    this.setSyncState(
      this.snapshot.lastSyncedAt === undefined
        ? { status: "syncing" }
        : { status: "synced", lastSyncedAt: this.snapshot.lastSyncedAt },
    );
    this.triggerSync();
    return cloneSnapshot(this.snapshot);
  }

  async write(key: string, value: unknown): Promise<void> {
    await this.ensureLoaded();
    this.mutationCounter += 1;
    const mutation = createMutation(
      this.instanceId,
      this.now,
      this.mutationCounter,
      "set",
      key,
      value,
      this.revisions.get(key),
    );
    this.snapshot.entries[key] = value;
    this.pendingWrites.set(key, value);
    this.localContext.set(mutation.mutationId, { mutation, localValue: value, localRevision: mutation.baseRevision });
    await this.snapshotCache.saveSnapshot(cloneSnapshot(this.snapshot));
    await this.mutationQueue.enqueueMutation(mutation);
    await this.refreshQueueDiagnostics();
    this.updateOfflineOrSchedule();
  }

  async remove(key: string): Promise<void> {
    await this.ensureLoaded();
    this.mutationCounter += 1;
    const mutation = createMutation(
      this.instanceId,
      this.now,
      this.mutationCounter,
      "remove",
      key,
      undefined,
      this.revisions.get(key),
    );
    delete this.snapshot.entries[key];
    this.pendingWrites.set(key, undefined);
    this.localContext.set(mutation.mutationId, { mutation, localValue: undefined, localRevision: mutation.baseRevision });
    await this.snapshotCache.saveSnapshot(cloneSnapshot(this.snapshot));
    await this.mutationQueue.enqueueMutation(mutation);
    await this.refreshQueueDiagnostics();
    this.updateOfflineOrSchedule();
  }

  sync(): Promise<SyncResult> {
    if (this.syncInFlight !== undefined) {
      return this.syncInFlight;
    }
    const run = this.runSyncCycle().finally(() => {
      this.syncInFlight = undefined;
    });
    this.syncInFlight = run;
    return run;
  }

  triggerSync(): void {
    void this.sync();
  }

  setOnline(isOnline: boolean): void {
    this.online = isOnline;
    if (!isOnline) {
      this.clearRetryTimer();
      this.setSyncState({
        status: "offline",
        lastSyncedAt: this.snapshot.lastSyncedAt ?? 0,
        pendingWriteCount: this.getPendingWriteCount(),
      });
      return;
    }
    this.retryAttempt = 0;
    this.triggerSync();
  }

  getSyncState(): SyncStatus {
    return this.syncState;
  }

  onSyncStateChange(listener: (state: SyncStatus) => void): () => void {
    this.syncStateListeners.add(listener);
    return () => this.syncStateListeners.delete(listener);
  }

  getDiagnostics(): SyncDiagnostics {
    return { ...this.diagnostics };
  }

  onDiagnosticsChange(listener: (diagnostics: SyncDiagnostics) => void): () => void {
    this.diagnosticsListeners.add(listener);
    return () => this.diagnosticsListeners.delete(listener);
  }

  getPendingWrites(): ReadonlyMap<string, unknown> {
    return new Map(this.pendingWrites);
  }

  private setSyncState(state: SyncStatus): void {
    this.syncState = state;
    this.options.onSyncStateChange?.(state);
    for (const listener of this.syncStateListeners) {
      listener(state);
    }
  }

  private updateDiagnostics(partial: Partial<SyncDiagnostics>): void {
    this.diagnostics = { ...this.diagnostics, ...partial };
    const current = this.getDiagnostics();
    this.options.onDiagnosticsChange?.(current);
    for (const listener of this.diagnosticsListeners) {
      listener(current);
    }
  }

  private setQueue(queue: { pendingCount: number; inFlightCount: number }): void {
    this.queueMeta = { pendingCount: queue.pendingCount, inFlightCount: queue.inFlightCount };
  }

  private getPendingWriteCount(): number {
    return this.queueMeta.pendingCount + this.queueMeta.inFlightCount;
  }

  private async runSyncCycle(): Promise<SyncResult> {
    await this.ensureLoaded();
    if (!this.online) {
      const queue = await this.mutationQueue.getQueueMetadata();
      this.setQueue(queue);
      this.updateDiagnostics({ pendingCount: queue.pendingCount });
      this.setSyncState({
        status: "offline",
        lastSyncedAt: this.snapshot.lastSyncedAt ?? 0,
        pendingWriteCount: this.getPendingWriteCount(),
      });
      return { pulled: 0, pushed: 0, conflicts: [] };
    }

    this.clearRetryTimer();
    this.setSyncState({ status: "syncing" });

    const push = await flushQueue({
      snapshotCache: this.snapshotCache,
      mutationQueue: this.mutationQueue,
      transport: this.transport,
      batchSize: this.batchSize,
      now: this.now,
      snapshot: this.snapshot,
      pendingWrites: this.pendingWrites,
      revisions: this.revisions,
      localContext: this.localContext,
      conflictResolution: this.conflictResolution,
      createMutation: (operation, key, value, forcedBaseRevision) => {
        this.mutationCounter += 1;
        return createMutation(
          this.instanceId,
          this.now,
          this.mutationCounter,
          operation,
          key,
          value,
          forcedBaseRevision,
        );
      },
      onError: async (syncError) => {
        const queue = await this.mutationQueue.getQueueMetadata();
        this.setQueue(queue);
        this.updateDiagnostics({
          pendingCount: queue.pendingCount,
          lastError: {
            code: syncError.code,
            message: syncError.message,
            retryable: syncError.retryable,
          },
        });
        if (syncError.retryable) {
          this.scheduleRetry(syncError);
        } else {
          this.clearRetryTimer();
        }
        this.setSyncState({ status: "error", error: syncError.message, lastSyncedAt: this.snapshot.lastSyncedAt });
      },
    });

    if (push.shouldStop) {
      return { pulled: 0, pushed: push.pushed, conflicts: push.conflicts };
    }

    const pulled = await pullChanges({
      snapshotCache: this.snapshotCache,
      mutationQueue: this.mutationQueue,
      transport: this.transport,
      batchSize: this.batchSize,
      now: this.now,
      snapshot: this.snapshot,
      pendingWrites: this.pendingWrites,
      revisions: this.revisions,
      localContext: this.localContext,
      conflictResolution: this.conflictResolution,
      createMutation: () => {
        throw new Error("createMutation is unused in pullChanges");
      },
    });

    const queue = await this.mutationQueue.getQueueMetadata();
    const lastSyncedAt = this.snapshot.lastSyncedAt ?? this.now();
    this.setQueue(queue);
    this.updateDiagnostics({ pendingCount: queue.pendingCount, lastSyncedAt, lastError: undefined });
    this.retryAttempt = 0;

    if (push.conflicts.length > 0) {
      this.setSyncState({ status: "conflict", conflicts: push.conflicts });
    } else if (this.getPendingWriteCount() > 0) {
      this.setSyncState({ status: "syncing" });
    } else {
      this.setSyncState({ status: "synced", lastSyncedAt });
    }

    return { pulled, pushed: push.pushed, conflicts: push.conflicts };
  }

  private scheduleRetry(lastError: ReturnType<typeof classifySyncError>): void {
    const next = scheduleRetryState(this.retryAttempt, lastError, {
      retryBaseMs: this.retryBaseMs,
      retryMaxMs: this.retryMaxMs,
      now: this.now,
    });
    this.retryAttempt = next.retryAttempt;
    this.clearRetryTimer();

    const delay = calculateRetryDelay({
      retryAttempt: next.retryAttempt,
      retryBaseMs: this.retryBaseMs,
      retryMaxMs: this.retryMaxMs,
      now: this.now,
    });
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      if (this.online) {
        this.triggerSync();
      }
    }, delay);
    (this.retryTimer as { unref?: () => void }).unref?.();
  }

  private updateOfflineOrSchedule(): void {
    if (!this.online) {
      this.setSyncState({
        status: "offline",
        lastSyncedAt: this.snapshot.lastSyncedAt ?? 0,
        pendingWriteCount: this.getPendingWriteCount(),
      });
      return;
    }
    this.triggerSync();
  }

  private async refreshQueueDiagnostics(): Promise<void> {
    const queue = await this.mutationQueue.getQueueMetadata();
    this.setQueue(queue);
    this.updateDiagnostics({ pendingCount: queue.pendingCount });
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== undefined) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
  }
}
