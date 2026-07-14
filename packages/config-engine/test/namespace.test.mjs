import {
  qualifyKey,
  deriveNamespace,
  validateKeyFormat,
  extractNamespace,
} from "../src/namespace.ts";

test("qualifyKey combines namespace + relative key", () => {
  const result = qualifyKey("ghost.vesselView", "map.defaultZoom");
  expect(result).toBe("ghost.vesselView.map.defaultZoom");
});

test("qualifyKey with single-segment relative key", () => {
  const result = qualifyKey("ghost.vesselView", "theme");
  expect(result).toBe("ghost.vesselView.theme");
});

test("deriveNamespace converts kebab-case plugin IDs", () => {
  expect(deriveNamespace("ghost.vessel-view")).toBe("ghost.vesselView");
});

test("deriveNamespace handles scoped package names", () => {
  expect(deriveNamespace("@weaver-conf/vessel-view-plugin")).toBe("weaverConf.vesselView");
});

test("deriveNamespace strips -plugin suffix from scoped names", () => {
  expect(deriveNamespace("@weaver-conf/theme-default-plugin")).toBe("weaverConf.themeDefault");
});

test("deriveNamespace passes through already-correct format", () => {
  expect(deriveNamespace("ghost.vesselView")).toBe("ghost.vesselView");
});

test("validateKeyFormat accepts valid 3-segment key", () => {
  const result = validateKeyFormat("ghost.vesselView.theme");
  expect(result.valid).toBe(true);
});

test("validateKeyFormat accepts valid 4-segment key", () => {
  const result = validateKeyFormat("ghost.vesselView.map.defaultZoom");
  expect(result.valid).toBe(true);
});

test("validateKeyFormat accepts valid 5-segment key", () => {
  const result = validateKeyFormat("ghost.vesselView.views.vesselGrid.pageSize");
  expect(result.valid).toBe(true);
});

test("validateKeyFormat accepts valid 2-segment key", () => {
  const result = validateKeyFormat("ghost.vesselView");
  expect(result.valid).toBe(true);
});

test("validateKeyFormat accepts valid 6-segment key", () => {
  const result = validateKeyFormat("ghost.vesselView.a.b.c.d");
  expect(result.valid).toBe(true);
});

test("validateKeyFormat rejects segments starting with numbers", () => {
  const result = validateKeyFormat("ghost.vesselView.1invalid");
  expect(result.valid).toBe(false);
  expect(result.error).toBeTruthy();
});

test("validateKeyFormat rejects empty segments", () => {
  const result = validateKeyFormat("ghost..map");
  expect(result.valid).toBe(false);
  expect(result.error).toBeTruthy();
});

test("validateKeyFormat rejects segments with special characters", () => {
  const result = validateKeyFormat("ghost.vessel-view.map");
  expect(result.valid).toBe(false);
  expect(result.error).toBeTruthy();
});

test("extractNamespace returns first two segments", () => {
  expect(extractNamespace("ghost.vesselView.map.zoom")).toBe("ghost.vesselView");
});

test("extractNamespace with 3-segment key", () => {
  expect(extractNamespace("ghost.vesselView.theme")).toBe("ghost.vesselView");
});
