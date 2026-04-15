import type {
  ConfigurationLayerData,
  DurableConfigCache,
  SyncCursor,
  SyncErrorMetadata,
  SyncQueueMetadata,
  SyncQueuedMutation,
} from "@weaver/config-types";

interface InFlightRequest {
  requestId: string;
  mutations: SyncQueuedMutation[];
}

interface QueueState {
  pending: SyncQueuedMutation[];
  inFlight: InFlightRequest[];
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptySnapshot(): ConfigurationLayerData {
  return { entries: {} };
}

export class MemoryDurableConfigCacheAdapter implements DurableConfigCache {
  private snapshot: ConfigurationLayerData = emptySnapshot();
  private cursor: SyncCursor | undefined;
  private queue: QueueState = { pending: [], inFlight: [] };

  async loadSnapshot(): Promise<ConfigurationLayerData> {
    return cloneValue(this.snapshot);
  }

  async saveSnapshot(data: ConfigurationLayerData): Promise<void> {
    this.snapshot = cloneValue(data);
  }

  async getCursor(): Promise<SyncCursor | undefined> {
    return this.cursor === undefined ? undefined : cloneValue(this.cursor);
  }

  async setCursor(cursor: SyncCursor): Promise<void> {
    this.cursor = cloneValue(cursor);
  }

  async enqueueMutation(mutation: SyncQueuedMutation): Promise<void> {
    this.queue.pending.push(cloneValue(mutation));
  }

  async peekQueuedMutations(limit: number): Promise<ReadonlyArray<SyncQueuedMutation>> {
    return this.queue.pending.slice(0, limit).map((mutation) => cloneValue(mutation));
  }

  async markRequestInFlight(requestId: string, mutationIds: ReadonlyArray<string>): Promise<void> {
    const picked: SyncQueuedMutation[] = [];
    const pickedIdSet = new Set(mutationIds);

    this.queue.pending = this.queue.pending.filter((mutation) => {
      if (!pickedIdSet.has(mutation.mutationId)) {
        return true;
      }
      picked.push({
        ...mutation,
        metadata: {
          ...mutation.metadata,
          attemptCount: mutation.metadata.attemptCount + 1,
          lastAttemptAt: Date.now(),
        },
      });
      return false;
    });

    if (picked.length === 0) {
      return;
    }

    this.queue.inFlight = this.queue.inFlight.filter((entry) => entry.requestId !== requestId);
    this.queue.inFlight.push({ requestId, mutations: picked });
  }

  async acknowledgeRequest(requestId: string): Promise<void> {
    this.queue.inFlight = this.queue.inFlight.filter((entry) => entry.requestId !== requestId);
  }

  async releaseRequest(requestId: string, _error: SyncErrorMetadata): Promise<void> {
    const remainingInFlight: InFlightRequest[] = [];
    let released: SyncQueuedMutation[] = [];

    for (const entry of this.queue.inFlight) {
      if (entry.requestId === requestId) {
        released = entry.mutations;
      } else {
        remainingInFlight.push(entry);
      }
    }

    this.queue.inFlight = remainingInFlight;
    if (released.length > 0) {
      this.queue.pending = [...released, ...this.queue.pending];
    }
  }

  async getQueueMetadata(): Promise<SyncQueueMetadata> {
    const allQueued = [...this.queue.pending, ...this.queue.inFlight.flatMap((entry) => entry.mutations)];
    const queuedAtValues = allQueued.map((mutation) => mutation.metadata.queuedAt);

    return {
      pendingCount: this.queue.pending.length,
      inFlightCount: this.queue.inFlight.reduce((count, entry) => count + entry.mutations.length, 0),
      oldestQueuedAt: queuedAtValues.length > 0 ? Math.min(...queuedAtValues) : undefined,
      newestQueuedAt: queuedAtValues.length > 0 ? Math.max(...queuedAtValues) : undefined,
    };
  }
}
