import test from "node:test";
import assert from "node:assert/strict";
import {
  qualifyKey,
  deriveNamespace,
  validateKeyFormat,
  extractNamespace,
} from "../dist/index.js";

test("qualifyKey combines namespace + relative key", () => {
  const result = qualifyKey("ghost.vesselView", "map.defaultZoom");
  assert.equal(result, "ghost.vesselView.map.defaultZoom");
});

test("qualifyKey with single-segment relative key", () => {
  const result = qualifyKey("ghost.vesselView", "theme");
  assert.equal(result, "ghost.vesselView.theme");
});

test("deriveNamespace converts kebab-case plugin IDs", () => {
  assert.equal(deriveNamespace("ghost.vessel-view"), "ghost.vesselView");
});

test("deriveNamespace handles scoped package names", () => {
  assert.equal(deriveNamespace("@weaver/vessel-view-plugin"), "weaver.vesselView");
});

test("deriveNamespace strips -plugin suffix from scoped names", () => {
  assert.equal(deriveNamespace("@weaver/theme-default-plugin"), "weaver.themeDefault");
});

test("deriveNamespace passes through already-correct format", () => {
  assert.equal(deriveNamespace("ghost.vesselView"), "ghost.vesselView");
});

test("validateKeyFormat accepts valid 3-segment key", () => {
  const result = validateKeyFormat("ghost.vesselView.theme");
  assert.equal(result.valid, true);
});

test("validateKeyFormat accepts valid 4-segment key", () => {
  const result = validateKeyFormat("ghost.vesselView.map.defaultZoom");
  assert.equal(result.valid, true);
});

test("validateKeyFormat accepts valid 5-segment key", () => {
  const result = validateKeyFormat("ghost.vesselView.views.vesselGrid.pageSize");
  assert.equal(result.valid, true);
});

test("validateKeyFormat rejects too few segments", () => {
  const result = validateKeyFormat("ghost.vesselView");
  assert.equal(result.valid, false);
  assert.ok(result.error);
});

test("validateKeyFormat rejects too many segments (6)", () => {
  const result = validateKeyFormat("ghost.vesselView.a.b.c.d");
  assert.equal(result.valid, false);
  assert.ok(result.error);
});

test("validateKeyFormat rejects segments starting with numbers", () => {
  const result = validateKeyFormat("ghost.vesselView.1invalid");
  assert.equal(result.valid, false);
  assert.ok(result.error);
});

test("validateKeyFormat rejects empty segments", () => {
  const result = validateKeyFormat("ghost..map");
  assert.equal(result.valid, false);
  assert.ok(result.error);
});

test("validateKeyFormat rejects segments with special characters", () => {
  const result = validateKeyFormat("ghost.vessel-view.map");
  assert.equal(result.valid, false);
  assert.ok(result.error);
});

test("extractNamespace returns first two segments", () => {
  assert.equal(extractNamespace("ghost.vesselView.map.zoom"), "ghost.vesselView");
});

test("extractNamespace with 3-segment key", () => {
  assert.equal(extractNamespace("ghost.vesselView.theme"), "ghost.vesselView");
});
