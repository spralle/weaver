import test from "node:test";
import assert from "node:assert/strict";
import { buildScopeChain } from "../dist/index.js";

const hierarchy = {
  scopes: [
    { id: "country", label: "Country" },
    { id: "site", label: "Site", parentScopeId: "country" },
    { id: "department", label: "Department", parentScopeId: "site" },
  ],
};

test("empty scope path returns success with empty chain", () => {
  const result = buildScopeChain(hierarchy, []);
  assert.deepEqual(result, { success: true, chain: [] });
});

test("valid single-level scope path", () => {
  const result = buildScopeChain(hierarchy, [
    { scopeId: "country", value: "NO" },
  ]);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.chain, [{ scopeId: "country", value: "NO" }]);
  }
});

test("valid multi-level scope path (country -> site)", () => {
  const result = buildScopeChain(hierarchy, [
    { scopeId: "country", value: "NO" },
    { scopeId: "site", value: "Bergen" },
  ]);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.chain, [
      { scopeId: "country", value: "NO" },
      { scopeId: "site", value: "Bergen" },
    ]);
  }
});

test("valid three-level scope path", () => {
  const result = buildScopeChain(hierarchy, [
    { scopeId: "country", value: "NO" },
    { scopeId: "site", value: "Bergen" },
    { scopeId: "department", value: "Operations" },
  ]);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.chain.length, 3);
  }
});

test("unknown scope ID returns error", () => {
  const result = buildScopeChain(hierarchy, [
    { scopeId: "region", value: "Nordic" },
  ]);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.includes("region"));
  }
});

test("invalid parent-child ordering returns error", () => {
  // site requires country to appear first
  const result = buildScopeChain(hierarchy, [
    { scopeId: "site", value: "Bergen" },
    { scopeId: "country", value: "NO" },
  ]);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.includes("country"));
  }
});
