import { test, describe } from "bun:test";
import assert from "node:assert/strict";
import { createGitWriteQueue } from "../../src/git/write-queue.ts";

test("FIFO ordering: operations execute in submission order", async () => {
  const queue = createGitWriteQueue();
  const order = [];

  const p1 = queue.enqueue(async () => { order.push(1); return 1; });
  const p2 = queue.enqueue(async () => { order.push(2); return 2; });
  const p3 = queue.enqueue(async () => { order.push(3); return 3; });

  await Promise.all([p1, p2, p3]);
  assert.deepEqual(order, [1, 2, 3]);
});

test("serialization: operations do not overlap", async () => {
  const queue = createGitWriteQueue();
  let concurrent = 0;
  let maxConcurrent = 0;

  async function tracked() {
    concurrent++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise((r) => setTimeout(r, 10));
    concurrent--;
  }

  const p1 = queue.enqueue(tracked);
  const p2 = queue.enqueue(tracked);
  const p3 = queue.enqueue(tracked);

  await Promise.all([p1, p2, p3]);
  assert.equal(maxConcurrent, 1);
});

test("error isolation: failing operation does not block subsequent", async () => {
  const queue = createGitWriteQueue();

  const p1 = queue.enqueue(async () => { throw new Error("fail"); });
  const p2 = queue.enqueue(async () => "success");

  await assert.rejects(p1, { message: "fail" });
  const result = await p2;
  assert.equal(result, "success");
});

test("queue depth limit: rejects with QUEUE_FULL", async () => {
  const queue = createGitWriteQueue({ maxDepth: 2 });

  // First enqueue starts processing immediately (shifted out of queue)
  // So we need to fill the queue while first is processing
  const p1 = queue.enqueue(() => new Promise((r) => setTimeout(() => r(1), 100)));
  // Now processing=true, queue is empty after shift. p2 and p3 go into queue.
  const p2 = queue.enqueue(() => new Promise((r) => setTimeout(() => r(2), 100)));
  const p3 = queue.enqueue(() => new Promise((r) => setTimeout(() => r(3), 100)));
  // queue now has 2 items (p2, p3), which equals maxDepth
  const p4 = queue.enqueue(() => Promise.resolve(4));

  await assert.rejects(p4, (err) => {
    assert.equal(err.code, "QUEUE_FULL");
    return true;
  });

  await Promise.all([p1, p2, p3]);
});

test("drain: waits for all operations to complete", async () => {
  const queue = createGitWriteQueue();
  const results = [];

  queue.enqueue(async () => {
    await new Promise((r) => setTimeout(r, 10));
    results.push("a");
  });
  queue.enqueue(async () => {
    await new Promise((r) => setTimeout(r, 10));
    results.push("b");
  });

  await queue.drain();
  assert.deepEqual(results, ["a", "b"]);
});

test("drain on empty queue resolves immediately", async () => {
  const queue = createGitWriteQueue();
  await queue.drain();
  assert.ok(true);
});

test("pending count and isProcessing state", async () => {
  const queue = createGitWriteQueue();
  assert.equal(queue.pending, 0);
  assert.equal(queue.isProcessing, false);

  let resolveFirst;
  const p1 = queue.enqueue(() => new Promise((r) => { resolveFirst = r; }));
  const p2 = queue.enqueue(async () => "done");

  // First is processing (shifted out), second is pending
  assert.equal(queue.pending, 1);
  assert.equal(queue.isProcessing, true);

  resolveFirst("ok");
  await Promise.all([p1, p2]);
  assert.equal(queue.pending, 0);
  assert.equal(queue.isProcessing, false);
});
