import { describe, expect, test } from "bun:test";
import type {
  ConfigSyncTransport,
  ConfigurationLayerData,
  SyncMutationQueue,
  SyncSnapshotCache,
} from "@weaver/config-types";
import { createConfigSyncOrchestrator } from "../src/index.js";

function createMockTransport(): ConfigSyncTransport {
  return {
    pull: async () => ({ changes: [], cursor: undefined }),
    push: async () => ({ acknowledged: [], conflicts: [] }),
    ack: async () => ({}),
  };
}

function createMockSnapshotCache(): SyncSnapshotCache {
  let snapshot: ConfigurationLayerData = { entries: {} };
  return {
    loadSnapshot: async () => snapshot,
    saveSnapshot: async (s) => {
      snapshot = s;
    },
    getCursor: async () => undefined,
    setCursor: async () => {},
  };
}

function createMockMutationQueue(): SyncMutationQueue {
  return {
    enqueueMutation: async () => {},
    peekQueuedMutations: async () => [],
    markRequestInFlight: async () => {},
    acknowledgeRequest: async () => {},
    releaseRequest: async () => {},
    getQueueMetadata: async () => ({ size: 0, oldestTimestamp: undefined }),
  };
}

describe("orchestrator dispose", () => {
  test("dispose() prevents further explicit sync cycles", async () => {
    let pullCount = 0;
    const transport = createMockTransport();
    transport.pull = async () => {
      pullCount++;
      return { changes: [], cursor: undefined };
    };

    const orchestrator = createConfigSyncOrchestrator({
      transport,
      snapshotCache: createMockSnapshotCache(),
      mutationQueue: createMockMutationQueue(),
    });

    await orchestrator.load();
    // Wait for the initial triggerSync from load() to complete
    await new Promise((r) => setTimeout(r, 50));
    const countBeforeDispose = pullCount;

    orchestrator.dispose();

    // Explicit sync after dispose should not increment
    await orchestrator.sync().catch(() => {});
    orchestrator.triggerSync();
    await new Promise((r) => setTimeout(r, 100));
    expect(pullCount).toBe(countBeforeDispose);
  });

  test("dispose() is idempotent", () => {
    const orchestrator = createConfigSyncOrchestrator({
      transport: createMockTransport(),
      snapshotCache: createMockSnapshotCache(),
      mutationQueue: createMockMutationQueue(),
    });
    orchestrator.dispose();
    orchestrator.dispose(); // should not throw
  });
});
