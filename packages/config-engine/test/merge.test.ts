import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deepMerge } from "../src/merge.js";

describe("deepMerge", () => {
  it("deep merges nested objects", () => {
    const a = { x: { y: 1 } };
    const b = { x: { z: 2 } };
    assert.deepEqual(deepMerge(a, b), { x: { y: 1, z: 2 } });
  });

  it("replaces arrays wholesale", () => {
    const a = { arr: [1, 2, 3] };
    const b = { arr: [4, 5] };
    const result = deepMerge(a, b);
    assert.deepEqual(result.arr, [4, 5]);
  });

  it("null in override clears the value", () => {
    const a = { x: { y: 1, z: 2 } };
    const b = { x: null } as unknown as Record<string, unknown>;
    const result = deepMerge(a, b);
    assert.equal(result.x, null);
  });

  it("undefined in override is skipped", () => {
    const a = { x: 1 };
    const b = { x: undefined };
    assert.deepEqual(deepMerge(a, b), { x: 1 });
  });

  it("override primitives replace base", () => {
    const a = { x: 1 };
    const b = { x: 2 };
    assert.deepEqual(deepMerge(a, b), { x: 2 });
  });

  it("adds new keys from override", () => {
    const a = { x: 1 };
    const b = { y: 2 };
    assert.deepEqual(deepMerge(a, b), { x: 1, y: 2 });
  });

  it("does not mutate inputs", () => {
    const a = { x: { y: 1 } };
    const b = { x: { z: 2 } };
    deepMerge(a, b);
    assert.deepEqual(a, { x: { y: 1 } });
    assert.deepEqual(b, { x: { z: 2 } });
  });
});
