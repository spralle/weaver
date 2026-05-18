import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePath,
  buildPath,
  isCompoundSegment,
  pathDepth,
  validateKeyFormat,
  extractNamespace,
} from "../dist/index.js";

// parsePath tests

test("parsePath: simple dot path", () => {
  assert.deepEqual(parsePath("a.b.c"), ["a", "b", "c"]);
});

test("parsePath: single bracket", () => {
  assert.deepEqual(parsePath("a.b[c.d].e"), ["a", "b", "c.d", "e"]);
});

test("parsePath: multiple brackets", () => {
  assert.deepEqual(parsePath("a[b.c][d.e]"), ["a", "b.c", "d.e"]);
});

test("parsePath: leading bracket", () => {
  assert.deepEqual(parsePath("[a.b].c"), ["a.b", "c"]);
});

test("parsePath: trailing bracket", () => {
  assert.deepEqual(parsePath("a.b[c.d]"), ["a", "b", "c.d"]);
});

test("parsePath: full Lynx example", () => {
  assert.deepEqual(
    parsePath("lynx.plugins[ghost.settings.panel].retentionDays"),
    ["lynx", "plugins", "ghost.settings.panel", "retentionDays"],
  );
});

test("parsePath: no brackets", () => {
  assert.deepEqual(parsePath("simple.key.here"), ["simple", "key", "here"]);
});

test("parsePath: single segment", () => {
  assert.deepEqual(parsePath("single"), ["single"]);
});

test("parsePath: error on unmatched [", () => {
  assert.throws(() => parsePath("a[b.c"), /Unmatched '\['/);
});

test("parsePath: error on unmatched ]", () => {
  assert.throws(() => parsePath("a]b"), /Unmatched '\]'/);
});

test("parsePath: error on empty brackets", () => {
  assert.throws(() => parsePath("a[]"), /Empty brackets/);
});

test("parsePath: error on nested brackets", () => {
  assert.throws(() => parsePath("a[[b]]"), /Nested brackets/);
});

test("parsePath: error on empty string", () => {
  assert.throws(() => parsePath(""), /must not be empty/);
});

test("parsePath: error on leading dot", () => {
  assert.throws(() => parsePath(".a.b"), /Empty segment/);
});

test("parsePath: error on trailing dot", () => {
  assert.throws(() => parsePath("a.b."), /Trailing dot/);
});

test("parsePath: error on double dot", () => {
  assert.throws(() => parsePath("a..b"), /Empty segment/);
});

// buildPath tests

test("buildPath: simple segments", () => {
  assert.equal(buildPath(["a", "b", "c"]), "a.b.c");
});

test("buildPath: compound segment", () => {
  assert.equal(buildPath(["a", "b", "c.d", "e"]), "a.b[c.d].e");
});

test("buildPath: multiple compounds", () => {
  assert.equal(buildPath(["a", "b.c", "d.e"]), "a[b.c][d.e]");
});

test("buildPath: single compound", () => {
  assert.equal(buildPath(["a.b"]), "[a.b]");
});

test("buildPath: round-trip simple", () => {
  const segments = ["a", "b", "c"];
  assert.deepEqual(parsePath(buildPath(segments)), segments);
});

test("buildPath: round-trip compound", () => {
  const segments = ["lynx", "plugins", "ghost.settings.panel", "retentionDays"];
  assert.deepEqual(parsePath(buildPath(segments)), segments);
});

test("buildPath: round-trip multiple compounds", () => {
  const segments = ["a", "b.c", "d.e"];
  assert.deepEqual(parsePath(buildPath(segments)), segments);
});

// isCompoundSegment tests

test("isCompoundSegment: compound", () => {
  assert.equal(isCompoundSegment("ghost.settings.panel"), true);
});

test("isCompoundSegment: simple", () => {
  assert.equal(isCompoundSegment("simple"), false);
});

// pathDepth tests

test("pathDepth: simple path", () => {
  assert.equal(pathDepth("a.b.c"), 3);
});

test("pathDepth: bracket path", () => {
  assert.equal(pathDepth("a.b[c.d].e"), 4);
});

// validateKeyFormat with brackets

test("validateKeyFormat: bracket key with 4 segments is valid", () => {
  const result = validateKeyFormat("lynx.plugins[ghost.settings.panel].retentionDays");
  assert.equal(result.valid, true);
});

test("validateKeyFormat: bracket key with 5 segments is valid", () => {
  const result = validateKeyFormat("a.b[c.d.e].f.g");
  assert.equal(result.valid, true);
});

test("validateKeyFormat: bracket key with 6 segments is valid", () => {
  const result = validateKeyFormat("a.b[c.d.e].f.g.h");
  assert.equal(result.valid, true);
});

test("validateKeyFormat: bracket key with 2 segments is valid", () => {
  const result = validateKeyFormat("a[b]");
  assert.equal(result.valid, true);
});

test("validateKeyFormat: invalid chars in compound segment", () => {
  const result = validateKeyFormat("a.b[c.1bad].d");
  assert.equal(result.valid, false);
});

// extractNamespace with brackets

test("extractNamespace: bracket key returns first two segments", () => {
  assert.equal(
    extractNamespace("lynx.plugins[ghost.settings.panel].retentionDays"),
    "lynx.plugins",
  );
});

test("extractNamespace: simple key unchanged behavior", () => {
  assert.equal(extractNamespace("app.vesselView.map.zoom"), "app.vesselView");
});
