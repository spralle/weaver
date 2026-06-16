import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deepGet, deepRemove, deepSet } from "../src/deep.js";

describe("deepGet", () => {
  it("retrieves nested values", () => {
    const obj = { a: { b: { c: 42 } } };
    assert.equal(deepGet(obj, "a.b.c"), 42);
  });

  it("returns undefined for missing paths", () => {
    assert.equal(deepGet({}, "a.b.c"), undefined);
  });

  it("returns undefined when traversing through a primitive", () => {
    assert.equal(deepGet({ a: 5 }, "a.b"), undefined);
  });

  it("handles top-level keys", () => {
    assert.equal(deepGet({ foo: "bar" }, "foo"), "bar");
  });

  it("returns undefined when traversing through null", () => {
    assert.equal(
      deepGet({ a: null } as Record<string, unknown>, "a.b"),
      undefined,
    );
  });
});

describe("deepSet", () => {
  it("sets nested values creating intermediates", () => {
    const obj: Record<string, unknown> = {};
    deepSet(obj, "a.b.c", 42);
    assert.deepEqual(obj, { a: { b: { c: 42 } } });
  });

  it("overwrites existing values", () => {
    const obj: Record<string, unknown> = { a: { b: 1 } };
    deepSet(obj, "a.b", 2);
    assert.equal((obj.a as Record<string, unknown>).b, 2);
  });

  it("overwrites primitives along the path with objects", () => {
    const obj: Record<string, unknown> = { a: "string" };
    deepSet(obj, "a.b", 10);
    assert.deepEqual(obj, { a: { b: 10 } });
  });

  it("sets top-level keys", () => {
    const obj: Record<string, unknown> = {};
    deepSet(obj, "x", 99);
    assert.equal(obj.x, 99);
  });
});

describe("deepRemove", () => {
  it("removes nested keys and returns true", () => {
    const obj: Record<string, unknown> = { a: { b: 1, c: 2 } };
    const result = deepRemove(obj, "a.b");
    assert.equal(result, true);
    assert.deepEqual(obj, { a: { c: 2 } });
  });

  it("returns false for non-existent paths", () => {
    assert.equal(deepRemove({}, "a.b.c"), false);
  });

  it("removes top-level keys", () => {
    const obj: Record<string, unknown> = { x: 1, y: 2 };
    assert.equal(deepRemove(obj, "x"), true);
    assert.deepEqual(obj, { y: 2 });
  });

  it("returns false when parent is a primitive", () => {
    const obj: Record<string, unknown> = { a: 5 };
    assert.equal(deepRemove(obj, "a.b"), false);
  });
});
