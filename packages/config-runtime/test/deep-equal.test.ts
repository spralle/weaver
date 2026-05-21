import { describe, expect, test } from "bun:test";
import { createStateContainer } from "../src/state-container.js";

describe("deep equality diffing", () => {
  test("no false positive: same nested structure, different reference", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { config: { a: 1, b: { c: 2 } } } }],
    });
    let fired = false;
    container.subscribe("config", () => {
      fired = true;
    });
    container.setLayer({ id: "a", priority: 0, entries: { config: { a: 1, b: { c: 2 } } } });
    expect(fired).toBe(false);
  });

  test("detects actual change in nested value", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { config: { a: 1, b: { c: 2 } } } }],
    });
    let fired = false;
    container.subscribe("config", () => {
      fired = true;
    });
    container.setLayer({ id: "a", priority: 0, entries: { config: { a: 1, b: { c: 999 } } } });
    expect(fired).toBe(true);
  });

  test("handles null values correctly", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { x: null } }],
    });
    let fired = false;
    container.subscribe("x", () => {
      fired = true;
    });
    container.setLayer({ id: "a", priority: 0, entries: { x: null } });
    expect(fired).toBe(false);
  });

  test("handles array values", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { items: [1, 2, 3] } }],
    });
    let fired = false;
    container.subscribe("items", () => {
      fired = true;
    });
    container.setLayer({ id: "a", priority: 0, entries: { items: [1, 2, 3] } });
    expect(fired).toBe(false);
  });

  test("detects array change", () => {
    const container = createStateContainer({
      layers: [{ id: "a", priority: 0, entries: { items: [1, 2, 3] } }],
    });
    let fired = false;
    container.subscribe("items", () => {
      fired = true;
    });
    container.setLayer({ id: "a", priority: 0, entries: { items: [1, 2, 4] } });
    expect(fired).toBe(true);
  });
});
