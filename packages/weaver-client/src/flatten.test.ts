import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { flattenObject } from "./flatten";

describe("flattenObject", () => {
  it("flattens a nested object to dot-delimited keys", () => {
    const result = flattenObject({ db: { host: "localhost", port: 5432 } });
    assert.deepEqual(result, { "db.host": "localhost", "db.port": 5432 });
  });

  it("applies prefix when provided", () => {
    const result = flattenObject({ host: "localhost" }, "db");
    assert.deepEqual(result, { "db.host": "localhost" });
  });

  it("handles deeply nested objects", () => {
    const result = flattenObject({ a: { b: { c: 1 } } });
    assert.deepEqual(result, { "a.b.c": 1 });
  });

  it("preserves arrays as values", () => {
    const result = flattenObject({ tags: ["a", "b"] });
    assert.deepEqual(result, { tags: ["a", "b"] });
  });

  it("handles flat objects (no nesting)", () => {
    const result = flattenObject({ key: "value" });
    assert.deepEqual(result, { key: "value" });
  });

  it("returns empty object for empty input", () => {
    assert.deepEqual(flattenObject({}), {});
  });

  it("handles null values", () => {
    assert.deepEqual(flattenObject({ a: null }), { a: null });
  });

  it("wraps compound keys (dots in key names) in brackets", () => {
    const result = flattenObject({
      plugins: { "ghost.settings.panel": { retentionDays: 30 } },
    });
    assert.deepEqual(result, {
      "plugins[ghost.settings.panel].retentionDays": 30,
    });
  });

  it("handles mixed nesting depths", () => {
    const result = flattenObject({
      simple: "val",
      nested: { deep: { value: 42 } },
      shallow: { key: true },
    });
    assert.deepEqual(result, {
      simple: "val",
      "nested.deep.value": 42,
      "shallow.key": true,
    });
  });
});
