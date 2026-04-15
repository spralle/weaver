import test from "node:test";
import assert from "node:assert/strict";

import {
  MemoryDurableConfigCacheAdapter,
} from "../dist/index.js";

const DEFAULT_ERROR = { code: "network", message: "offline", retryable: true };

function buildMutation(mutationId, operation, value = undefined) {
  return {
    mutationId,
    key: `ghost.key.${mutationId}`,
    operation,
    value,
    metadata: {
      queuedAt: 1000 + Number(mutationId.replace(/\D/g, "") || 0),
      attemptCount: 0,
      policyAllowed: true,
    },
  };
}

async function verifyDurableContract(cacheFactory) {
  const cache = cacheFactory();

  await cache.saveSnapshot({ entries: { theme: "dark" } });

  const snapshot = await cache.loadSnapshot();
  assert.deepEqual(snapshot.entries, { theme: "dark" });

  await cache.setCursor({ serverRevision: "rev-a", serverTime: 10 });
  assert.deepEqual(await cache.getCursor(), { serverRevision: "rev-a", serverTime: 10 });

  const setMutation = buildMutation("m1", "set", "value-1");
  const removeMutation = buildMutation("m2", "remove");

  await cache.enqueueMutation(setMutation);
  await cache.enqueueMutation(removeMutation);

  const beforeFlight = await cache.peekQueuedMutations(10);
  assert.deepEqual(beforeFlight.map((m) => m.mutationId), ["m1", "m2"]);
  assert.equal(beforeFlight[1].operation, "remove");
  assert.equal("value" in beforeFlight[1], true);
  assert.equal(beforeFlight[1].value, undefined);

  await cache.markRequestInFlight("req-1", ["m1", "m2"]);
  const afterMark = await cache.peekQueuedMutations(10);
  assert.deepEqual(afterMark, []);

  const markedMeta = await cache.getQueueMetadata();
  assert.equal(markedMeta.pendingCount, 0);
  assert.equal(markedMeta.inFlightCount, 2);
  assert.equal(markedMeta.oldestQueuedAt, 1001);
  assert.equal(markedMeta.newestQueuedAt, 1002);

  await cache.releaseRequest("req-1", DEFAULT_ERROR);
  const afterRelease = await cache.peekQueuedMutations(10);
  assert.deepEqual(afterRelease.map((m) => m.mutationId), ["m1", "m2"]);
  assert.equal(afterRelease[1].operation, "remove");

  await cache.markRequestInFlight("req-2", ["m1", "m2"]);
  await cache.acknowledgeRequest("req-2");
  const afterAck = await cache.getQueueMetadata();
  assert.equal(afterAck.pendingCount, 0);
  assert.equal(afterAck.inFlightCount, 0);
}

test("MemoryDurableConfigCacheAdapter satisfies durable cache contract", async () => {
  await verifyDurableContract(() => new MemoryDurableConfigCacheAdapter());
});
