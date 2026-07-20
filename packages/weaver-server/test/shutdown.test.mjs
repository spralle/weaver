import { createShutdownManager } from "@weaver-conf/weaver-server";

describe("ShutdownManager", () => {
  it("shutdown runs handlers in order", async () => {
    const order = [];
    const mgr = createShutdownManager();
    mgr.onShutdown(async () => { order.push(1); });
    mgr.onShutdown(async () => { order.push(2); });

    await mgr.shutdown();

    expect(order).toEqual([1, 2]);
  });

  it("isShuttingDown flag is set", async () => {
    const mgr = createShutdownManager();
    expect(mgr.isShuttingDown).toBe(false);

    await mgr.shutdown();

    expect(mgr.isShuttingDown).toBe(true);
  });

  it("multiple handlers execute", async () => {
    const results = [];
    const mgr = createShutdownManager();
    mgr.onShutdown(async () => { results.push("a"); });
    mgr.onShutdown(async () => { results.push("b"); });
    mgr.onShutdown(async () => { results.push("c"); });

    await mgr.shutdown();

    expect(results.length).toBe(3);
  });

  it("timeout forces completion", async () => {
    const mgr = createShutdownManager({ drainTimeoutMs: 50 });
    mgr.onShutdown(async () => {
      await new Promise((r) => setTimeout(r, 5000));
    });

    const start = Date.now();
    await mgr.shutdown();
    const elapsed = Date.now() - start;

    expect(elapsed < 1000).toBeTruthy();
  });
});
