import { createStalenessMonitor } from "../src/staleness.js";

describe("StalenessMonitor", () => {
  it("is fresh after creation", () => {
    const monitor = createStalenessMonitor({
      maxAge: 1000,
      checkInterval: 500,
    });
    expect(monitor.isStale).toBe(false);
    expect(monitor.staleSince).toBe(null);
    monitor.dispose();
  });

  it("becomes stale after maxAge passes", async () => {
    const monitor = createStalenessMonitor({
      maxAge: 30,
      checkInterval: 10,
    });

    // Wait for staleness to trigger
    await new Promise((r) => setTimeout(r, 60));
    expect(monitor.isStale).toBe(true);
    expect(monitor.staleSince !== null).toBeTruthy();
    monitor.dispose();
  });

  it("onStalenessChange fires on transition", async () => {
    const monitor = createStalenessMonitor({
      maxAge: 30,
      checkInterval: 10,
    });

    const calls: boolean[] = [];
    monitor.onStalenessChange((isStale) => calls.push(isStale));

    await new Promise((r) => setTimeout(r, 60));
    expect(calls).toEqual([true]);
    monitor.dispose();
  });

  it("recordSync() clears stale state", async () => {
    const monitor = createStalenessMonitor({
      maxAge: 30,
      checkInterval: 10,
    });

    await new Promise((r) => setTimeout(r, 60));
    expect(monitor.isStale).toBe(true);

    monitor.recordSync();
    expect(monitor.isStale).toBe(false);
    expect(monitor.staleSince).toBe(null);
    monitor.dispose();
  });

  it("dispose() stops timer and no further transitions", async () => {
    const monitor = createStalenessMonitor({
      maxAge: 30,
      checkInterval: 10,
    });

    const calls: boolean[] = [];
    monitor.onStalenessChange((s) => calls.push(s));
    monitor.dispose();

    await new Promise((r) => setTimeout(r, 60));
    expect(calls).toEqual([]);
    expect(monitor.isStale).toBe(false);
  });

  it("unsubscribe removes listener", async () => {
    const monitor = createStalenessMonitor({
      maxAge: 30,
      checkInterval: 10,
    });

    const calls: boolean[] = [];
    const unsub = monitor.onStalenessChange((s) => calls.push(s));
    unsub();

    await new Promise((r) => setTimeout(r, 60));
    expect(calls).toEqual([]);
    monitor.dispose();
  });
});
