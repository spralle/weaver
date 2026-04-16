import assert from "node:assert/strict";
import test from "node:test";

import { createConfigSyncOrchestrator } from "../dist/index.js";
import { MemoryDurableConfigCacheAdapter } from "../../config-providers/dist/index.js";

function createTransportHarness() {
  const pushQueue = [];
  const pullQueue = [];
  const pushes = [];
  const pulls = [];
  const acks = [];

  const transport = {
    async pull(request) {
      pulls.push(request);
      return pullQueue.shift() ?? {
        cursor: { serverRevision: "rev-0", serverTime: 0 },
        serverTime: 0,
        changes: [],
      };
    },
    async push(request) {
      pushes.push(request);
      const next = pushQueue.shift();
      if (next instanceof Error) {
        throw next;
      }
      return next ?? {
        requestId: request.requestId,
        serverRevision: "rev-1",
        serverTime: Date.now(),
        results: request.mutations.map((mutation, idx) => ({
          mutationId: mutation.mutationId,
          accepted: true,
          revision: `rev-${idx + 1}`,
        })),
      };
    },
    async ack(request) {
      acks.push(request);
      return {
        requestId: request.requestId,
        acked: true,
        serverRevision: "rev-ack",
        serverTime: Date.now(),
      };
    },
  };

  return { transport, pushQueue, pullQueue, pushes, pulls, acks };
}

test("offline boot reads cache snapshot without network", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  await cache.saveSnapshot({
    entries: { "ghost.theme": "dark" },
    revision: "rev-cached",
    lastSyncedAt: 100,
  });
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  orchestrator.setOnline(false);
  const snapshot = await orchestrator.load();

  assert.equal(snapshot.entries["ghost.theme"], "dark");
  assert.equal(harness.pushes.length, 0);
  assert.equal(harness.pulls.length, 0);
  assert.equal(orchestrator.getSyncState().status, "offline");
});

test("reconnect flushes queued writes then pulls", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  orchestrator.setOnline(false);
  await orchestrator.load();
  await orchestrator.write("ghost.theme", "dark");
  assert.equal((await cache.getQueueMetadata()).pendingCount, 1);

  harness.pullQueue.push({
    cursor: { serverRevision: "rev-2", serverTime: 300 },
    serverTime: 300,
    changes: [],
  });

  orchestrator.setOnline(true);
  const result = await orchestrator.sync();

  assert.equal(result.pushed, 1);
  assert.equal(result.pulled, 0);
  assert.equal(harness.pushes.length, 1);
  assert.equal(harness.acks.length, 1);
  assert.equal((await cache.getQueueMetadata()).pendingCount, 0);
  assert.equal(orchestrator.getSyncState().status, "synced");
});

test("conflict path surfaces conflict state and server value", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  orchestrator.setOnline(false);
  await orchestrator.load();
  await orchestrator.write("ghost.mode", "compact");
  const queued = await cache.peekQueuedMutations(10);

  harness.pushQueue.push({
    requestId: "req-1",
    serverRevision: "rev-22",
    serverTime: 500,
    results: [
      {
        mutationId: queued[0].mutationId,
        accepted: false,
        conflict: {
          key: "ghost.mode",
          mutationId: queued[0].mutationId,
          localRevision: "rev-10",
          serverRevision: "rev-22",
          localValue: "compact",
          serverValue: "expanded",
          serverTime: 500,
        },
      },
    ],
  });
  harness.pullQueue.push({
    cursor: { serverRevision: "rev-22", serverTime: 500 },
    serverTime: 500,
    changes: [],
  });

  orchestrator.setOnline(true);
  const result = await orchestrator.sync();
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].key, "ghost.mode");
  assert.equal(orchestrator.getSyncState().status, "conflict");
});

test("lww-fallback requeues mutation after conflict", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
    conflictResolution: "lww-fallback",
  });

  orchestrator.setOnline(false);
  await orchestrator.load();
  await orchestrator.write("ghost.mode", "compact");
  const queued = await cache.peekQueuedMutations(10);

  harness.pushQueue.push({
    requestId: "req-1",
    serverRevision: "rev-22",
    serverTime: 500,
    results: [
      {
        mutationId: queued[0].mutationId,
        accepted: false,
        conflict: {
          key: "ghost.mode",
          mutationId: queued[0].mutationId,
          localRevision: "rev-10",
          serverRevision: "rev-22",
          localValue: "compact",
          serverValue: "expanded",
          serverTime: 500,
        },
      },
    ],
  });
  const lwwError = new Error("offline");
  lwwError.code = "network";
  lwwError.retryable = true;
  harness.pushQueue.push(lwwError);
  harness.pullQueue.push({
    cursor: { serverRevision: "rev-22", serverTime: 500 },
    serverTime: 500,
    changes: [],
  });

  orchestrator.setOnline(true);
  await orchestrator.sync();
  const after = await cache.peekQueuedMutations(10);
  assert.equal(after.length, 1);
  assert.equal(after[0].baseRevision, "rev-22");
});

test("retryable error keeps queue and schedules retry", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const nowValues = [1000, 1010, 1020, 1030, 1040, 1050];
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
    now: () => nowValues.shift() ?? 2000,
  });

  orchestrator.setOnline(false);
  await orchestrator.load();
  await orchestrator.write("ghost.retry", true);
  const retryError = new Error("offline");
  retryError.code = "network";
  retryError.retryable = true;
  harness.pushQueue.push(retryError);

  orchestrator.setOnline(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const queue = await cache.getQueueMetadata();
  const diagnostics = orchestrator.getDiagnostics();

  assert.equal(queue.pendingCount, 1);
  assert.equal(orchestrator.getSyncState().status, "error");
  assert.equal(diagnostics.pendingCount, 1);
  assert.equal("retryAttempt" in diagnostics, false);
  assert.equal("retryScheduledAt" in diagnostics, false);
  assert.equal("queue" in diagnostics, false);
  assert.deepEqual(diagnostics.lastError, {
    code: "network",
    message: "offline",
    retryable: true,
  });
});

test("tenant isolation via separate orchestrator instances with separate caches", async () => {
  const cacheA = new MemoryDurableConfigCacheAdapter();
  const cacheB = new MemoryDurableConfigCacheAdapter();
  const harnessA = createTransportHarness();
  const harnessB = createTransportHarness();

  const a = createConfigSyncOrchestrator({
    snapshotCache: cacheA,
    mutationQueue: cacheA,
    transport: harnessA.transport,
  });
  const b = createConfigSyncOrchestrator({
    snapshotCache: cacheB,
    mutationQueue: cacheB,
    transport: harnessB.transport,
  });

  a.setOnline(false);
  b.setOnline(false);
  await a.load();
  await b.load();
  await a.write("ghost.theme", "dark");
  await b.write("ghost.theme", "light");

  const queueA = await cacheA.peekQueuedMutations(10);
  const queueB = await cacheB.peekQueuedMutations(10);

  assert.equal(queueA.length, 1);
  assert.equal(queueB.length, 1);
  assert.notEqual(queueA[0].mutationId, queueB[0].mutationId);
});

// --- Error classification (tested indirectly via orchestrator behavior) ---

test("error classification: SyncErrorMetadata object passes through unchanged", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  orchestrator.setOnline(false);
  await orchestrator.load();
  await orchestrator.write("ghost.key", "val");

  const err = new Error("server error");
  err.code = "server";
  err.retryable = true;
  harness.pushQueue.push(err);

  orchestrator.setOnline(true);
  await new Promise((r) => setTimeout(r, 0));
  const diag = orchestrator.getDiagnostics();
  assert.deepEqual(diag.lastError, { code: "server", message: "server error", retryable: true });
});

test("error classification: plain Error gets code unknown and retryable false", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  orchestrator.setOnline(false);
  await orchestrator.load();
  await orchestrator.write("ghost.key", "val");

  harness.pushQueue.push(new Error("something broke"));

  orchestrator.setOnline(true);
  await new Promise((r) => setTimeout(r, 0));
  const diag = orchestrator.getDiagnostics();
  assert.deepEqual(diag.lastError, { code: "unknown", message: "something broke", retryable: false });
});

test("error classification: error with syncError property is unwrapped", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  orchestrator.setOnline(false);
  await orchestrator.load();
  await orchestrator.write("ghost.key", "val");

  const wrapper = new Error("wrapper");
  wrapper.syncError = { code: "timeout", message: "timed out", retryable: true };
  harness.pushQueue.push(wrapper);

  orchestrator.setOnline(true);
  await new Promise((r) => setTimeout(r, 0));
  const diag = orchestrator.getDiagnostics();
  assert.deepEqual(diag.lastError, { code: "timeout", message: "timed out", retryable: true });
});

// --- Batch push behavior ---

test("batch push sends multiple batches when queue exceeds batchSize", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
    batchSize: 2,
  });

  orchestrator.setOnline(false);
  await orchestrator.load();
  await orchestrator.write("k1", "v1");
  await orchestrator.write("k2", "v2");
  await orchestrator.write("k3", "v3");
  await orchestrator.write("k4", "v4");

  harness.pullQueue.push({
    cursor: { serverRevision: "rev-10", serverTime: 1000 },
    serverTime: 1000,
    changes: [],
  });

  orchestrator.setOnline(true);
  const result = await orchestrator.sync();

  assert.equal(result.pushed, 4);
  assert.ok(harness.pushes.length >= 2, `expected >= 2 pushes, got ${harness.pushes.length}`);
});

// --- Remove operation ---

test("remove() creates a remove mutation and deletes key from snapshot", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  orchestrator.setOnline(false);
  await orchestrator.load();
  await orchestrator.write("ghost.theme", "dark");
  await orchestrator.remove("ghost.theme");

  const queued = await cache.peekQueuedMutations(10);
  const removeMutation = queued.find((m) => m.operation === "remove");
  assert.ok(removeMutation, "expected a remove mutation in queue");
  assert.equal(removeMutation.key, "ghost.theme");

  const snapshot = await cache.loadSnapshot();
  assert.equal(snapshot.entries["ghost.theme"], undefined);
});

// --- Online/offline transitions ---

test("offline to online triggers sync", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  orchestrator.setOnline(false);
  await orchestrator.load();
  await orchestrator.write("ghost.key", "val");

  harness.pullQueue.push({
    cursor: { serverRevision: "rev-5", serverTime: 500 },
    serverTime: 500,
    changes: [],
  });

  orchestrator.setOnline(true);
  const result = await orchestrator.sync();
  assert.equal(result.pushed, 1);
  assert.equal(orchestrator.getSyncState().status, "synced");
});

test("going offline sets status to offline and clears retry", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  orchestrator.setOnline(false);
  await orchestrator.load();
  assert.equal(orchestrator.getSyncState().status, "offline");

  // Going offline again is idempotent
  orchestrator.setOnline(false);
  assert.equal(orchestrator.getSyncState().status, "offline");
});

test("double setOnline(false) is idempotent", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  orchestrator.setOnline(false);
  await orchestrator.load();
  orchestrator.setOnline(false);
  orchestrator.setOnline(false);
  assert.equal(orchestrator.getSyncState().status, "offline");
  assert.equal(harness.pushes.length, 0);
  assert.equal(harness.pulls.length, 0);
});

// --- Diagnostics and state listeners ---

test("onSyncStateChange listener fires on state transitions", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  const states = [];
  orchestrator.onSyncStateChange((state) => states.push(state.status));

  orchestrator.setOnline(false);
  await orchestrator.load();

  assert.ok(states.includes("offline"), `expected offline in states: ${JSON.stringify(states)}`);
});

test("onDiagnosticsChange listener fires on diagnostics updates", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  const diagnosticsLog = [];
  orchestrator.onDiagnosticsChange((d) => diagnosticsLog.push({ ...d }));

  orchestrator.setOnline(false);
  await orchestrator.load();
  await orchestrator.write("ghost.key", "val");

  assert.ok(diagnosticsLog.length > 0, "expected diagnostics change events");
});

test("unsubscribe from listeners stops notifications", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  const states = [];
  const unsub = orchestrator.onSyncStateChange((state) => states.push(state.status));

  orchestrator.setOnline(false);
  await orchestrator.load();
  const countAfterOffline = states.length;

  unsub();
  orchestrator.setOnline(true);
  // After unsub, no new states should be added
  // Allow any triggered sync to settle
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(states.length, countAfterOffline, "listener should not fire after unsubscribe");
});

// --- Pull with server changes ---

test("pullChanges applies server-side changes to snapshot", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  orchestrator.setOnline(false);
  await orchestrator.load();

  harness.pullQueue.push({
    cursor: { serverRevision: "rev-5", serverTime: 500 },
    serverTime: 500,
    changes: [
      { key: "server.key", value: "server-value", operation: "set", revision: "rev-5" },
    ],
  });

  orchestrator.setOnline(true);
  const result = await orchestrator.sync();
  assert.equal(result.pulled, 1);

  const snapshot = await cache.loadSnapshot();
  assert.equal(snapshot.entries["server.key"], "server-value");
});

// --- getPendingWrites ---

test("getPendingWrites contains written key before sync", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  orchestrator.setOnline(false);
  await orchestrator.load();
  await orchestrator.write("ghost.pending", "value");

  const pending = orchestrator.getPendingWrites();
  assert.equal(pending.has("ghost.pending"), true);
  assert.equal(pending.get("ghost.pending"), "value");
});

test("getPendingWrites is cleared after successful sync", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const harness = createTransportHarness();
  const orchestrator = createConfigSyncOrchestrator({
    snapshotCache: cache,
    mutationQueue: cache,
    transport: harness.transport,
  });

  orchestrator.setOnline(false);
  await orchestrator.load();
  await orchestrator.write("ghost.pending", "value");

  harness.pullQueue.push({
    cursor: { serverRevision: "rev-5", serverTime: 500 },
    serverTime: 500,
    changes: [],
  });

  orchestrator.setOnline(true);
  await orchestrator.sync();

  const pending = orchestrator.getPendingWrites();
  assert.equal(pending.has("ghost.pending"), false);
  assert.equal(pending.size, 0);
});
