import type {
  ConfigSyncTransport,
  ConfigurationLayerData,
  SyncMutationQueue,
  SyncSnapshotCache,
} from "@weaver-conf/config-types";
import { createConfigSyncOrchestrator } from "../src/index.js";

function createMockTransport(): ConfigSyncTransport {
  return {
    pull: async () => ({
      changes: [],
      cursor: { serverRevision: "rev-0", serverTime: 0 },
      serverTime: 0,
    }),
    push: async (request) => ({
      requestId: request.requestId,
      serverRevision: "rev-0",
      serverTime: 0,
      results: [],
    }),
    ack: async (request) => ({
      requestId: request.requestId,
      acked: true,
      serverRevision: "rev-0",
      serverTime: 0,
    }),
  };
}

function createMockSnapshotCache(): SyncSnapshotCache {
  let snapshot: ConfigurationLayerData = { entries: {} };
  return {
    loadSnapshot: async () => snapshot,
    saveSnapshot: async (s) => {
      snapshot = s;
    },
    getCursor: async () => ({ serverRevision: "rev-0", serverTime: 0 }),
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
    getQueueMetadata: async () => ({ pendingCount: 0, inFlightCount: 0 }),
  };
}

describe("orchestrator dispose", () => {
  test("dispose() prevents further explicit sync cycles", async () => {
    let pullCount = 0;
    const transport = createMockTransport();
    transport.pull = async () => {
      pullCount++;
      return {
        changes: [],
        cursor: { serverRevision: "rev-0", serverTime: 0 },
        serverTime: 0,
      };
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
