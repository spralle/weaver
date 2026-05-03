import test from "node:test";
import assert from "node:assert/strict";
import { deepGet, deepSet, deepRemove } from "../dist/index.js";

// deepGet
test("deepGet: simple dot path", () => {
  const obj = { db: { host: "localhost", port: 5432 } };
  assert.equal(deepGet(obj, "db.host"), "localhost");
});

test("deepGet: returns subtree for intermediate path", () => {
  const obj = { db: { host: "localhost", port: 5432 } };
  assert.deepEqual(deepGet(obj, "db"), { host: "localhost", port: 5432 });
});

test("deepGet: returns undefined for missing path", () => {
  const obj = { db: { host: "localhost" } };
  assert.equal(deepGet(obj, "db.port"), undefined);
});

test("deepGet: returns undefined when traversing through primitive", () => {
  const obj = { db: "not-an-object" };
  assert.equal(deepGet(obj, "db.host"), undefined);
});

test("deepGet: returns undefined for completely missing root", () => {
  const obj = { db: { host: "localhost" } };
  assert.equal(deepGet(obj, "cache.ttl"), undefined);
});

test("deepGet: single segment", () => {
  const obj = { theme: "dark" };
  assert.equal(deepGet(obj, "theme"), "dark");
});

test("deepGet: deeply nested", () => {
  const obj = { a: { b: { c: { d: 42 } } } };
  assert.equal(deepGet(obj, "a.b.c.d"), 42);
});

test("deepGet: bracket notation (compound segment)", () => {
  const obj = { lynx: { plugins: { "ghost.settings.panel": { retentionDays: 30 } } } };
  assert.equal(deepGet(obj, "lynx.plugins[ghost.settings.panel].retentionDays"), 30);
});

test("deepGet: bracket notation subtree", () => {
  const obj = { lynx: { plugins: { "ghost.settings.panel": { retentionDays: 30, enabled: true } } } };
  assert.deepEqual(
    deepGet(obj, "lynx.plugins[ghost.settings.panel]"),
    { retentionDays: 30, enabled: true },
  );
});

test("deepGet: null along path returns undefined", () => {
  const obj = { db: null };
  assert.equal(deepGet(obj, "db.host"), undefined);
});

test("deepGet: returns null leaf", () => {
  const obj = { db: { host: null } };
  assert.equal(deepGet(obj, "db.host"), null);
});

// deepSet
test("deepSet: sets nested value", () => {
  const obj = { db: { host: "old" } };
  deepSet(obj, "db.host", "new");
  assert.equal(obj.db.host, "new");
});

test("deepSet: creates intermediate objects", () => {
  const obj = {};
  deepSet(obj, "db.host", "localhost");
  assert.deepEqual(obj, { db: { host: "localhost" } });
});

test("deepSet: overwrites primitive with object along path", () => {
  const obj = { db: "string-value" };
  deepSet(obj, "db.host", "localhost");
  assert.deepEqual(obj, { db: { host: "localhost" } });
});

test("deepSet: sets subtree (object value)", () => {
  const obj = {};
  deepSet(obj, "db", { host: "localhost", port: 5432 });
  assert.deepEqual(obj, { db: { host: "localhost", port: 5432 } });
});

test("deepSet: deeply nested creation", () => {
  const obj = {};
  deepSet(obj, "a.b.c.d", 42);
  assert.deepEqual(obj, { a: { b: { c: { d: 42 } } } });
});

test("deepSet: bracket notation", () => {
  const obj = { lynx: { plugins: {} } };
  deepSet(obj, "lynx.plugins[ghost.settings.panel].retentionDays", 30);
  assert.equal(obj.lynx.plugins["ghost.settings.panel"].retentionDays, 30);
});

test("deepSet: preserves siblings", () => {
  const obj = { db: { host: "old", port: 5432 } };
  deepSet(obj, "db.host", "new");
  assert.deepEqual(obj, { db: { host: "new", port: 5432 } });
});

test("deepSet: single segment", () => {
  const obj = {};
  deepSet(obj, "theme", "dark");
  assert.deepEqual(obj, { theme: "dark" });
});

test("deepSet: overwrites array with object if path continues", () => {
  const obj = { tags: ["a", "b"] };
  deepSet(obj, "tags.first", "x");
  assert.deepEqual(obj, { tags: { first: "x" } });
});

// deepRemove
test("deepRemove: removes leaf", () => {
  const obj = { db: { host: "localhost", port: 5432 } };
  const removed = deepRemove(obj, "db.host");
  assert.equal(removed, true);
  assert.deepEqual(obj, { db: { port: 5432 } });
});

test("deepRemove: does not prune empty parent", () => {
  const obj = { db: { host: "localhost" } };
  deepRemove(obj, "db.host");
  assert.deepEqual(obj, { db: {} });
});

test("deepRemove: removes subtree", () => {
  const obj = { db: { host: "localhost", port: 5432 }, cache: { ttl: 60 } };
  const removed = deepRemove(obj, "db");
  assert.equal(removed, true);
  assert.deepEqual(obj, { cache: { ttl: 60 } });
});

test("deepRemove: returns false for missing path", () => {
  const obj = { db: { host: "localhost" } };
  assert.equal(deepRemove(obj, "db.port"), false);
});

test("deepRemove: returns false when parent is primitive", () => {
  const obj = { db: "string" };
  assert.equal(deepRemove(obj, "db.host"), false);
});

test("deepRemove: single segment", () => {
  const obj = { theme: "dark", lang: "en" };
  const removed = deepRemove(obj, "theme");
  assert.equal(removed, true);
  assert.deepEqual(obj, { lang: "en" });
});

test("deepRemove: bracket notation", () => {
  const obj = { lynx: { plugins: { "ghost.settings.panel": { retentionDays: 30 } } } };
  deepRemove(obj, "lynx.plugins[ghost.settings.panel].retentionDays");
  assert.deepEqual(obj.lynx.plugins["ghost.settings.panel"], {});
});

test("deepRemove: returns false for empty parent chain", () => {
  const obj = {};
  assert.equal(deepRemove(obj, "a.b.c"), false);
});
