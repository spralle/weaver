import { createWriteQueue } from "../src/write-queue.js";

describe("createWriteQueue", () => {
  it("starts with zero pending", () => {
    const q = createWriteQueue();
    expect(q.pending).toBe(0);
  });

  it("enqueues and reports pending count", () => {
    const q = createWriteQueue();
    q.enqueue("a", 1);
    q.enqueue("b", 2);
    expect(q.pending).toBe(2);
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
    expect(sent).toEqual(["a:1", "b:2"]);
    expect(results.length).toBe(2);
    expect(q.pending).toBe(0);
  });

  it("clear empties the queue", () => {
    const q = createWriteQueue();
    q.enqueue("a", 1);
    q.clear();
    expect(q.pending).toBe(0);
  });
});
