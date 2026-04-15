import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveConfiguration,
  inspectKey,
  resolveConfigurationWithCeiling,
} from "../dist/index.js";

const testLayers = ["core","app","module","integrator","tenant","user","device","session"];
const getRank = (l) => { const i = testLayers.indexOf(l); return i >= 0 ? i : testLayers.length; };

test("resolves with single layer", () => {
  const stack = {
    layers: [
      { layer: "core", entries: { "ghost.app.theme": "dark" } },
    ],
  };
  const result = resolveConfiguration(stack);
  assert.deepEqual(result.entries, { "ghost.app.theme": "dark" });
  assert.equal(result.provenance.get("ghost.app.theme"), "core");
});

test("deep merges multiple layers in priority order", () => {
  const stack = {
    layers: [
      { layer: "core", entries: { "ghost.app.theme": "light", "ghost.app.lang": "en" } },
      { layer: "tenant", entries: { "ghost.app.theme": "dark" } },
    ],
  };
  const result = resolveConfiguration(stack);
  assert.equal(result.entries["ghost.app.theme"], "dark");
  assert.equal(result.entries["ghost.app.lang"], "en");
});

test("last layer wins for conflicting keys", () => {
  const stack = {
    layers: [
      { layer: "core", entries: { "ghost.app.zoom": 1 } },
      { layer: "app", entries: { "ghost.app.zoom": 2 } },
      { layer: "user", entries: { "ghost.app.zoom": 5 } },
    ],
  };
  const result = resolveConfiguration(stack);
  assert.equal(result.entries["ghost.app.zoom"], 5);
  assert.equal(result.provenance.get("ghost.app.zoom"), "user");
});

test("empty layers are skipped", () => {
  const stack = {
    layers: [
      { layer: "core", entries: { "ghost.app.theme": "light" } },
      { layer: "app", entries: {} },
      { layer: "tenant", entries: { "ghost.app.lang": "no" } },
    ],
  };
  const result = resolveConfiguration(stack);
  assert.deepEqual(result.entries, {
    "ghost.app.theme": "light",
    "ghost.app.lang": "no",
  });
});

test("provenance tracks which layer set each key", () => {
  const stack = {
    layers: [
      { layer: "core", entries: { "ghost.app.a": 1, "ghost.app.b": 2 } },
      { layer: "tenant", entries: { "ghost.app.b": 20 } },
      { layer: "user", entries: { "ghost.app.c": 3 } },
    ],
  };
  const result = resolveConfiguration(stack);
  assert.equal(result.provenance.get("ghost.app.a"), "core");
  assert.equal(result.provenance.get("ghost.app.b"), "tenant");
  assert.equal(result.provenance.get("ghost.app.c"), "user");
});

test("inspectKey returns per-layer values", () => {
  const stack = {
    layers: [
      { layer: "core", entries: { "ghost.app.zoom": 1 } },
      { layer: "tenant", entries: { "ghost.app.zoom": 3 } },
      { layer: "user", entries: { "ghost.app.zoom": 5 } },
    ],
  };
  const result = inspectKey(stack, "ghost.app.zoom");
  assert.equal(result.layerValues.core, 1);
  assert.equal(result.layerValues.tenant, 3);
  assert.equal(result.layerValues.user, 5);
});

test("inspectKey shows correct effectiveValue and effectiveLayer", () => {
  const stack = {
    layers: [
      { layer: "core", entries: { "ghost.app.zoom": 1 } },
      { layer: "app", entries: {} },
      { layer: "tenant", entries: { "ghost.app.zoom": 10 } },
    ],
  };
  const result = inspectKey(stack, "ghost.app.zoom");
  assert.equal(result.effectiveValue, 10);
  assert.equal(result.effectiveLayer, "tenant");
  assert.equal(result.key, "ghost.app.zoom");
});

test("inspectKey handles dynamic scope layers", () => {
  const stack = {
    layers: [
      { layer: "core", entries: { "ghost.app.zoom": 1 } },
      { layer: "country:NO", entries: { "ghost.app.zoom": 3 } },
    ],
  };
  const result = inspectKey(stack, "ghost.app.zoom");
  assert.equal(result.effectiveValue, 3);
  assert.equal(result.effectiveLayer, "country:NO");
  assert.equal(result.layerValues["country:NO"], 3);
});

test("inspectKey returns undefined for missing key", () => {
  const stack = {
    layers: [
      { layer: "core", entries: { "ghost.app.theme": "dark" } },
    ],
  };
  const result = inspectKey(stack, "ghost.app.nonexistent");
  assert.equal(result.effectiveValue, undefined);
  assert.equal(result.effectiveLayer, undefined);
});

test("resolveConfigurationWithCeiling respects maxOverrideLayer", () => {
  const stack = {
    layers: [
      { layer: "core", entries: { "ghost.app.zoom": 1 } },
      { layer: "tenant", entries: { "ghost.app.zoom": 5 } },
      { layer: "user", entries: { "ghost.app.zoom": 10 } },
    ],
  };
  const schemaMap = new Map([
    ["ghost.app.zoom", { maxOverrideLayer: "tenant" }],
  ]);
  const result = resolveConfigurationWithCeiling(stack, schemaMap, false, getRank);
  // user layer should be ignored because maxOverrideLayer is tenant
  assert.equal(result.entries["ghost.app.zoom"], 5);
});

test("resolveConfigurationWithCeiling emergency override bypasses ceiling", () => {
  const stack = {
    layers: [
      { layer: "core", entries: { "ghost.app.zoom": 1 } },
      { layer: "tenant", entries: { "ghost.app.zoom": 5 } },
      { layer: "user", entries: { "ghost.app.zoom": 10 } },
    ],
  };
  const schemaMap = new Map([
    ["ghost.app.zoom", { maxOverrideLayer: "tenant" }],
  ]);
  const result = resolveConfigurationWithCeiling(stack, schemaMap, true, getRank);
  // Emergency override: user layer should NOT be ignored
  assert.equal(result.entries["ghost.app.zoom"], 10);
});

test("resolveConfigurationWithCeiling allows keys without schema", () => {
  const stack = {
    layers: [
      { layer: "core", entries: { "ghost.app.zoom": 1 } },
      { layer: "user", entries: { "ghost.app.zoom": 10 } },
    ],
  };
  const schemaMap = new Map();
  const result = resolveConfigurationWithCeiling(stack, schemaMap, false, getRank);
  assert.equal(result.entries["ghost.app.zoom"], 10);
});
