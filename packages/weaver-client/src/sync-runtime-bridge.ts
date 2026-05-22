import { deepEqual } from "@weaver-conf/config-engine";
import type { StateContainer } from "@weaver-conf/config-runtime";
import type { ConfigSyncOrchestrator } from "@weaver-conf/config-sync";
import type { ConfigurationLayerData } from "@weaver-conf/config-types";

export interface SyncRuntimeBridgeOptions {
  orchestrator: ConfigSyncOrchestrator;
  container: StateContainer;
  remoteLayerId?: string | undefined;
  optimisticLayerId?: string | undefined;
  remoteLayerPriority?: number | undefined;
  optimisticLayerPriority?: number | undefined;
}

export interface SyncRuntimeBridge {
  /** Boot: load orchestrator snapshot, set remote layer */
  initialize(): Promise<void>;
  /** Write key/value optimistically + enqueue for sync */
  write(key: string, value: unknown): Promise<void>;
  /** Remove key optimistically + enqueue for sync */
  remove(key: string): Promise<void>;
  /** Handler to wire as orchestrator's onSnapshotChange callback */
  handleSnapshotChange(snapshot: ConfigurationLayerData): void;
  /** Dispose bridge (cleanup) */
  dispose(): void;
}

/**
 * Bridges config-sync orchestrator lifecycle events into a config-runtime StateContainer.
 * Uses a two-layer model: "remote" (server truth) + "optimistic" (pending local writes).
 */
export function createSyncRuntimeBridge(
  options: SyncRuntimeBridgeOptions,
): SyncRuntimeBridge {
  const {
    orchestrator,
    container,
    remoteLayerId = "remote",
    optimisticLayerId = "optimistic",
    remoteLayerPriority = 0,
    optimisticLayerPriority = 10,
  } = options;

  const pendingKeys = new Set<string>();
  const optimisticEntries: Record<string, unknown> = {};
  let disposed = false;

  function reconcileOptimistic(snapshot: ConfigurationLayerData): void {
    for (const key of [...pendingKeys]) {
      if (
        key in snapshot.entries &&
        deepEqual(snapshot.entries[key], optimisticEntries[key])
      ) {
        pendingKeys.delete(key);
        delete optimisticEntries[key];
      }
    }

    if (pendingKeys.size === 0) {
      container.removeLayer(optimisticLayerId);
    } else {
      container.setLayer({
        id: optimisticLayerId,
        priority: optimisticLayerPriority,
        entries: { ...optimisticEntries },
      });
    }
  }

  function handleSnapshotChange(snapshot: ConfigurationLayerData): void {
    if (disposed) return;

    container.setLayer({
      id: remoteLayerId,
      priority: remoteLayerPriority,
      entries: { ...snapshot.entries },
    });

    reconcileOptimistic(snapshot);
  }

  return {
    async initialize(): Promise<void> {
      const snapshot = await orchestrator.load();
      container.setLayer({
        id: remoteLayerId,
        priority: remoteLayerPriority,
        entries: { ...snapshot.entries },
      });
    },

    async write(key: string, value: unknown): Promise<void> {
      pendingKeys.add(key);
      optimisticEntries[key] = value;
      container.setLayer({
        id: optimisticLayerId,
        priority: optimisticLayerPriority,
        entries: { ...optimisticEntries },
      });
      await orchestrator.write(key, value);
    },

    async remove(key: string): Promise<void> {
      pendingKeys.add(key);
      optimisticEntries[key] = undefined;
      container.setLayer({
        id: optimisticLayerId,
        priority: optimisticLayerPriority,
        entries: { ...optimisticEntries },
      });
      await orchestrator.remove(key);
    },

    handleSnapshotChange,

    dispose(): void {
      disposed = true;
    },
  };
}
