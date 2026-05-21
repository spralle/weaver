import { describe, expect, mock, test } from "bun:test";
import { createStateContainer } from "../src/state-container.js";

describe("snapshot and hydrate", () => {
  test("snapshot captures current state", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { x: 1 } }],
    });
    const snap = container.snapshot();
    expect(snap.resolved).toEqual({ x: 1 });
    expect(snap.provenance).toEqual({ x: "a" });
    expect(snap.revision).toBe(1);
  });

  test("hydrate restores state", () => {
    const container = createStateContainer({ layers: [] });
    container.hydrate({
      resolved: { y: 42 },
      provenance: { y: "ext" },
      revision: 10,
    });
    expect(container.get("y")).toBe(42);
    expect(container.revision).toBe(10);
    expect(container.getProvenance("y")).toBe("ext");
  });

  test("subscriptions fire after hydrate", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { x: 1 } }],
    });
    const fn = mock(() => {});
    container.subscribe("x", fn);
    container.hydrate({
      resolved: { x: 99 },
      provenance: { x: "b" },
      revision: 5,
    });
    expect(fn).toHaveBeenCalledWith(99);
  });

  test("revision is restored from snapshot", () => {
    const container = createStateContainer({ layers: [] });
    container.hydrate({ resolved: {}, provenance: {}, revision: 77 });
    expect(container.revision).toBe(77);
  });
});
