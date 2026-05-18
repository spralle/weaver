import { describe, expect, mock, test } from "bun:test";
import { createStateContainer } from "../src/state-container.js";

describe("subscriptions", () => {
  test("subscribe fires on change at path", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { x: 1 } }],
    });
    const fn = mock(() => {});
    container.subscribe("x", fn);
    container.setLayer({ id: "b", priority: 10, entries: { x: 2 } });
    expect(fn).toHaveBeenCalledWith(2);
  });

  test("subscribe to parent fires when child changes", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { db: { host: "a" } } }],
    });
    const fn = mock(() => {});
    container.subscribe("db", fn);
    container.setLayer({
      id: "b",
      priority: 10,
      entries: { db: { host: "b" } },
    });
    expect(fn).toHaveBeenCalled();
  });

  test("unsubscribe stops notifications", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { x: 1 } }],
    });
    const fn = mock(() => {});
    const unsub = container.subscribe("x", fn);
    unsub();
    container.setLayer({ id: "b", priority: 10, entries: { x: 2 } });
    expect(fn).not.toHaveBeenCalled();
  });

  test("subscribeAll fires on any change", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { x: 1 } }],
    });
    const fn = mock(() => {});
    container.subscribeAll(fn);
    container.setLayer({ id: "b", priority: 10, entries: { y: 2 } });
    expect(fn).toHaveBeenCalled();
  });

  test("no notification when value unchanged", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { x: 1 } }],
    });
    const fn = mock(() => {});
    container.subscribe("x", fn);
    // Set same value
    container.setLayer({ id: "a", priority: 0, entries: { x: 1 } });
    expect(fn).not.toHaveBeenCalled();
  });
});
