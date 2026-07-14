import { buildScopeChain } from "../dist/scope.js";

const hierarchy = {
  scopes: [
    { id: "country", label: "Country" },
    { id: "site", label: "Site", parentScopeId: "country" },
    { id: "department", label: "Department", parentScopeId: "site" },
  ],
};

test("empty scope path returns success with empty chain", () => {
  const result = buildScopeChain(hierarchy, []);
  expect(result).toEqual({ success: true, chain: [] });
});

test("valid single-level scope path", () => {
  const result = buildScopeChain(hierarchy, [
    { scopeId: "country", value: "NO" },
  ]);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.chain).toEqual([{ scopeId: "country", value: "NO" }]);
  }
});

test("valid multi-level scope path (country -> site)", () => {
  const result = buildScopeChain(hierarchy, [
    { scopeId: "country", value: "NO" },
    { scopeId: "site", value: "Bergen" },
  ]);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.chain).toEqual([
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
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.chain.length).toBe(3);
  }
});

test("unknown scope ID returns error", () => {
  const result = buildScopeChain(hierarchy, [
    { scopeId: "region", value: "Nordic" },
  ]);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.includes("region")).toBeTruthy();
  }
});

test("invalid parent-child ordering returns error", () => {
  // site requires country to appear first
  const result = buildScopeChain(hierarchy, [
    { scopeId: "site", value: "Bergen" },
    { scopeId: "country", value: "NO" },
  ]);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.includes("country")).toBeTruthy();
  }
});
