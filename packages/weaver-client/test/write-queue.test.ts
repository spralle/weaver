import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createWriteQueue } from "../src/write-queue.js";

describe("createWriteQueue", () => {
  it("starts with zero pending", () => {
    const q = createWriteQueue();
    assert.equal(q.pending, 0);
  });

  it("enqueues and reports pending count", () => {
    const q = createWriteQueue();
    q.enqueue("a", 1);
    q.enqueue("b", 2);
    assert.equal(q.pending, 2);
  });

  it("drains in FIFO order", async () => {
    const q = createWriteQueue();
    q.enqueue("a", 1);
    q.enqueue("b", 2);
    const sent: string[] = [];
    const results = await q.drain(async (key, value) => {
      sent.push(`${key}:${value}`);
      return { success: true, revision: "r" };
    });
    assert.deepEqual(sent, ["a:1", "b:2"]);
    assert.equal(results.length, 2);
    assert.equal(q.pending, 0);
  });

  it("clear empties the queue", () => {
    const q = createWriteQueue();
    q.enqueue("a", 1);
    q.clear();
    assert.equal(q.pending, 0);
  });
});
