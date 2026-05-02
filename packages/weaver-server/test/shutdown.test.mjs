import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createShutdownManager } from "@weaver/weaver-server";

describe("ShutdownManager", () => {
  it("shutdown runs handlers in order", async () => {
    const order = [];
    const mgr = createShutdownManager();
    mgr.onShutdown(async () => { order.push(1); });
    mgr.onShutdown(async () => { order.push(2); });

    await mgr.shutdown();

    assert.deepEqual(order, [1, 2]);
  });

  it("isShuttingDown flag is set", async () => {
    const mgr = createShutdownManager();
    assert.equal(mgr.isShuttingDown, false);

    await mgr.shutdown();

    assert.equal(mgr.isShuttingDown, true);
  });

  it("multiple handlers execute", async () => {
    const results = [];
    const mgr = createShutdownManager();
    mgr.onShutdown(async () => { results.push("a"); });
    mgr.onShutdown(async () => { results.push("b"); });
    mgr.onShutdown(async () => { results.push("c"); });

    await mgr.shutdown();

    assert.equal(results.length, 3);
  });

  it("timeout forces completion", async () => {
    const mgr = createShutdownManager({ drainTimeoutMs: 50 });
    mgr.onShutdown(async () => {
      await new Promise((r) => setTimeout(r, 5000));
    });

    const start = Date.now();
    await mgr.shutdown();
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 1000, `Expected fast timeout, got ${elapsed}ms`);
  });
});
