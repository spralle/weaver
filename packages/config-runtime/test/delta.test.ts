import { describe, expect, mock, test } from "bun:test";
import { createStateContainer } from "../src/state-container.js";

describe("applyDelta", () => {
  test("set updates values", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { x: 1 } }],
    });
    container.applyDelta({ set: { x: 99 }, revision: 10 });
    expect(container.get("x")).toBe(99);
  });

  test("removed deletes values", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { x: 1, y: 2 } }],
    });
    container.applyDelta({ removed: ["x"], revision: 5 });
    expect(container.get("x")).toBeUndefined();
    expect(container.get("y")).toBe(2);
  });

  test("delta bumps revision", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { x: 1 } }],
    });
    container.applyDelta({ set: { x: 2 }, revision: 42 });
    expect(container.revision).toBe(42);
  });

  test("subscriptions fire after delta", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { x: 1 } }],
    });
    const fn = mock(() => {});
    container.subscribe("x", fn);
    container.applyDelta({ set: { x: 5 }, revision: 3 });
    expect(fn).toHaveBeenCalledWith(5);
  });

  test("set nested paths", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { db: { host: "a" } } }],
    });
    container.applyDelta({ set: { "db.host": "b" }, revision: 2 });
    expect(container.get("db.host")).toBe("b");
  });
});
