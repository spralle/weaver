import { describe, expect, test } from "bun:test";
import { createStateContainer } from "../src/state-container.js";

describe("createStateContainer", () => {
  test("resolves layers by priority (higher wins)", () => {
    const container = createStateContainer({
      layers: [
        {
          id: "base",
          priority: 0,
          entries: { database: { host: "localhost", port: 5432 } },
        },
        {
          id: "env",
          priority: 10,
          entries: { database: { host: "prod.db.com" } },
        },
      ],
    });

    expect(container.get("database.host")).toBe("prod.db.com");
    expect(container.get("database.port")).toBe(5432);
  });

  test("get returns undefined for missing paths", () => {
    const container = createStateContainer({ layers: [] });
    expect(container.get("nonexistent.path")).toBeUndefined();
  });

  test("getAll returns full resolved tree", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { foo: "bar" } }],
    });
    expect(container.getAll()).toEqual({ foo: "bar" });
  });

  test("setLayer adds and re-resolves", () => {
    const container = createStateContainer({
      layers: [{ id: "base", priority: 0, entries: { x: 1 } }],
    });
    container.setLayer({ id: "override", priority: 10, entries: { x: 2 } });
    expect(container.get("x")).toBe(2);
  });

  test("setLayer updates existing layer", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { x: 1 } }],
    });
    container.setLayer({ id: "a", priority: 0, entries: { x: 99 } });
    expect(container.get("x")).toBe(99);
  });

  test("removeLayer re-resolves", () => {
    const container = createStateContainer({
      layers: [
        { id: "base", priority: 0, entries: { x: 1 } },
        { id: "over", priority: 10, entries: { x: 2 } },
      ],
    });
    container.removeLayer("over");
    expect(container.get("x")).toBe(1);
  });

  test("getProvenance returns layer that provided top-level key", () => {
    const container = createStateContainer({
      layers: [
        { id: "base", priority: 0, entries: { db: { host: "a" } } },
        { id: "env", priority: 10, entries: { db: { host: "b" } } },
      ],
    });
    expect(container.getProvenance("db.host")).toBe("env");
  });

  test("custom merge function is used", () => {
    const container = createStateContainer({
      layers: [
        { id: "base", priority: 0, entries: { items: [1, 2] } },
        {
          id: "custom",
          priority: 10,
          entries: { items: [3] },
          merge: (base, override) => ({ ...base, ...override }),
        },
      ],
    });
    expect(container.get("items")).toEqual([3]);
  });

  test("revision increments on resolve", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { x: 1 } }],
    });
    const r1 = container.revision;
    container.setLayer({ id: "b", priority: 1, entries: { y: 2 } });
    expect(container.revision).toBe(r1 + 1);
  });
});
