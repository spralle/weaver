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
