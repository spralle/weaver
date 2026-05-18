import { describe, expect, test } from "bun:test";
import { createStateContainer } from "@weaver/config-runtime";
import { createSyncRuntimeBridge } from "../src/sync-runtime-bridge.js";

function createMockOrchestrator() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let loadResult = { entries: {}, revision: "rev-0", lastSyncedAt: 0 };

  return {
    calls,
    setLoadResult(result: typeof loadResult) {
      loadResult = result;
    },
    orchestrator: {
      async load() {
        calls.push({ method: "load", args: [] });
        return { ...loadResult, entries: { ...loadResult.entries } };
      },
      async write(key: string, value: unknown) {
        calls.push({ method: "write", args: [key, value] });
      },
      async remove(key: string) {
        calls.push({ method: "remove", args: [key] });
      },
      async sync() {
        return { pulled: 0, pushed: 0, conflicts: [] };
      },
      triggerSync() {},
      setOnline() {},
      getSyncState() {
        return { status: "synced" as const, lastSyncedAt: 0 };
      },
      onSyncStateChange() {
        return () => {};
      },
      getDiagnostics() {
        return { pendingCount: 0 };
      },
      onDiagnosticsChange() {
        return () => {};
      },
      getPendingWrites() {
        return new Map();
      },
    },
  };
}

describe("sync-runtime-bridge", () => {
  test("initialize() loads remote layer", async () => {
    const mock = createMockOrchestrator();
    mock.setLoadResult({
      entries: { theme: "dark", lang: "en" },
      revision: "rev-1",
      lastSyncedAt: 100,
    });
    const container = createStateContainer();
    const bridge = createSyncRuntimeBridge({
      orchestrator: mock.orchestrator as never,
      container,
    });

    await bridge.initialize();

    expect(container.get("theme")).toBe("dark");
    expect(container.get("lang")).toBe("en");
    expect(mock.calls[0]?.method).toBe("load");
  });

  test("write() creates optimistic layer", async () => {
    const mock = createMockOrchestrator();
    const container = createStateContainer();
    const bridge = createSyncRuntimeBridge({
      orchestrator: mock.orchestrator as never,
      container,
    });

    await bridge.initialize();
    await bridge.write("color", "blue");

    expect(container.get("color")).toBe("blue");
    expect(mock.calls.some((c) => c.method === "write")).toBe(true);
  });

  test("onSnapshotChange updates remote layer", async () => {
    const mock = createMockOrchestrator();
    const container = createStateContainer();
    const bridge = createSyncRuntimeBridge({
      orchestrator: mock.orchestrator as never,
      container,
    });

    await bridge.initialize();

    bridge.handleSnapshotChange({
      entries: { theme: "light", newKey: "hello" },
      revision: "rev-2",
      lastSyncedAt: 200,
    });

    expect(container.get("theme")).toBe("light");
    expect(container.get("newKey")).toBe("hello");
  });

  test("acknowledged write clears from optimistic", async () => {
    const mock = createMockOrchestrator();
    const container = createStateContainer();
    const bridge = createSyncRuntimeBridge({
      orchestrator: mock.orchestrator as never,
      container,
    });

    await bridge.initialize();
    await bridge.write("color", "blue");

    // Simulate server acknowledging the write
    bridge.handleSnapshotChange({
      entries: { color: "blue" },
      revision: "rev-3",
      lastSyncedAt: 300,
    });

    // Optimistic layer should be cleared; value comes from remote
    expect(container.get("color")).toBe("blue");
    expect(container.getProvenance("color")).toBe("remote");
  });

  test("remove() works", async () => {
    const mock = createMockOrchestrator();
    mock.setLoadResult({
      entries: { theme: "dark" },
      revision: "rev-1",
      lastSyncedAt: 100,
    });
    const container = createStateContainer();
    const bridge = createSyncRuntimeBridge({
      orchestrator: mock.orchestrator as never,
      container,
    });

    await bridge.initialize();
    await bridge.remove("theme");

    // Optimistic layer has undefined for theme, which overrides remote
    expect(mock.calls.some((c) => c.method === "remove")).toBe(true);
  });

  test("dispose() prevents further updates", async () => {
    const mock = createMockOrchestrator();
    const container = createStateContainer();
    const bridge = createSyncRuntimeBridge({
      orchestrator: mock.orchestrator as never,
      container,
    });

    await bridge.initialize();
    bridge.dispose();

    bridge.handleSnapshotChange({
      entries: { theme: "neon" },
      revision: "rev-99",
      lastSyncedAt: 999,
    });

    // Should not have updated
    expect(container.get("theme")).toBeUndefined();
  });
});
