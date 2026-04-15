import test from "node:test";
import assert from "node:assert/strict";
import { deepMerge } from "../dist/index.js";

test("deep merges nested objects", () => {
  const base = { a: { b: 1, c: 2 }, d: 3 };
  const override = { a: { b: 10 } };
  const result = deepMerge(base, override);
  assert.deepEqual(result, { a: { b: 10, c: 2 }, d: 3 });
});

test("arrays replace (don't concatenate)", () => {
  const base = { tags: [1, 2, 3] };
  const override = { tags: [4, 5] };
  const result = deepMerge(base, override);
  assert.deepEqual(result, { tags: [4, 5] });
});

test("primitives replace", () => {
  const base = { name: "old", count: 1 };
  const override = { name: "new", count: 99 };
  const result = deepMerge(base, override);
  assert.deepEqual(result, { name: "new", count: 99 });
});

test("null clears value", () => {
  const base = { a: 1, b: { c: 2 } };
  const override = { a: null, b: null };
  const result = deepMerge(base, override);
  assert.deepEqual(result, { a: null, b: null });
});

test("undefined is skipped", () => {
  const base = { a: 1, b: 2 };
  const override = { a: undefined, b: 3 };
  const result = deepMerge(base, override);
  assert.deepEqual(result, { a: 1, b: 3 });
});

test("empty objects handled", () => {
  const result1 = deepMerge({}, { a: 1 });
  assert.deepEqual(result1, { a: 1 });

  const result2 = deepMerge({ a: 1 }, {});
  assert.deepEqual(result2, { a: 1 });

  const result3 = deepMerge({}, {});
  assert.deepEqual(result3, {});
});

test("mixed types: override wins", () => {
  const base = { a: { nested: true } };
  const override = { a: "string now" };
  const result = deepMerge(base, override);
  assert.deepEqual(result, { a: "string now" });
});

test("override object replaces primitive base", () => {
  const base = { a: 42 };
  const override = { a: { nested: true } };
  const result = deepMerge(base, override);
  assert.deepEqual(result, { a: { nested: true } });
});

test("non-plain objects (arrays with objects, nested nulls)", () => {
  const base = { list: [{ id: 1 }] };
  const override = { list: [{ id: 2 }, { id: 3 }] };
  const result = deepMerge(base, override);
  assert.deepEqual(result, { list: [{ id: 2 }, { id: 3 }] });
});

test("deeply nested merge", () => {
  const base = { a: { b: { c: { d: 1, e: 2 } } } };
  const override = { a: { b: { c: { d: 10 } } } };
  const result = deepMerge(base, override);
  assert.deepEqual(result, { a: { b: { c: { d: 10, e: 2 } } } });
});

test("override adds new keys", () => {
  const base = { a: 1 };
  const override = { b: 2 };
  const result = deepMerge(base, override);
  assert.deepEqual(result, { a: 1, b: 2 });
});

test("does not mutate base or override", () => {
  const base = { a: { b: 1 } };
  const override = { a: { c: 2 } };
  deepMerge(base, override);
  assert.deepEqual(base, { a: { b: 1 } });
  assert.deepEqual(override, { a: { c: 2 } });
});
