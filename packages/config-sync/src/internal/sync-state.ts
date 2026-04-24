import type { SyncStatus } from "@weaver/config-types";
import type {
  ConfigSyncOrchestratorOptions,
  SyncDiagnostics,
} from "../types.js";

export interface SyncStateManager {
  getSyncState(): SyncStatus;
  setSyncState(state: SyncStatus): void;
  getDiagnostics(): SyncDiagnostics;
  updateDiagnostics(partial: Partial<SyncDiagnostics>): void;
  setQueue(queue: { pendingCount: number; inFlightCount: number }): void;
  getPendingWriteCount(): number;
  onSyncStateChange(listener: (state: SyncStatus) => void): () => void;
  onDiagnosticsChange(
    listener: (diagnostics: SyncDiagnostics) => void,
  ): () => void;
}

export function createSyncStateManager(
  options: ConfigSyncOrchestratorOptions,
): SyncStateManager {
  const syncStateListeners = new Set<(state: SyncStatus) => void>();
  const diagnosticsListeners = new Set<
    (diagnostics: SyncDiagnostics) => void
  >();

  let syncState: SyncStatus = { status: "syncing" };
  let diagnostics: SyncDiagnostics = { pendingCount: 0 };
  let queueMeta = { pendingCount: 0, inFlightCount: 0 };

  function setSyncState(state: SyncStatus): void {
    syncState = state;
    options.onSyncStateChange?.(state);
    for (const listener of syncStateListeners) {
      listener(state);
    }
  }

  function updateDiagnostics(partial: Partial<SyncDiagnostics>): void {
    diagnostics = { ...diagnostics, ...partial };
    const current = { ...diagnostics };
    options.onDiagnosticsChange?.(current);
    for (const listener of diagnosticsListeners) {
      listener(current);
    }
  }

  function setQueue(queue: {
    pendingCount: number;
    inFlightCount: number;
  }): void {
    queueMeta = {
      pendingCount: queue.pendingCount,
      inFlightCount: queue.inFlightCount,
    };
  }

  function getPendingWriteCount(): number {
    return queueMeta.pendingCount + queueMeta.inFlightCount;
  }

  return {
    getSyncState: () => syncState,
    setSyncState,
    getDiagnostics: () => ({ ...diagnostics }),
    updateDiagnostics,
    setQueue,
    getPendingWriteCount,
    onSyncStateChange(listener) {
      syncStateListeners.add(listener);
      return () => syncStateListeners.delete(listener);
    },
    onDiagnosticsChange(listener) {
      diagnosticsListeners.add(listener);
      return () => diagnosticsListeners.delete(listener);
    },
  };
}
