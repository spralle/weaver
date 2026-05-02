import test from "node:test";
import assert from "node:assert/strict";
import { SecretCache } from "../dist/index.js";

test("SecretCache can be instantiated", () => {
  const cache = new SecretCache();
  assert.equal(cache.size(), 0);
});

test("get() returns undefined for unknown key", () => {
  const cache = new SecretCache();
  assert.equal(cache.get("unknown"), undefined);
});

test("set() + get() round-trips", () => {
  const cache = new SecretCache();
  cache.set("key1", "secret-value", "v1");
  const entry = cache.get("key1");
  assert.equal(entry?.value, "secret-value");
  assert.equal(entry?.version, "v1");
});

test("expired entries return undefined", async () => {
  const cache = new SecretCache({ defaultTtlMs: 10 });
  cache.set("key1", "value");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(cache.get("key1"), undefined);
});

test("invalidate() removes an entry", () => {
  const cache = new SecretCache();
  cache.set("key1", "value");
  cache.invalidate("key1");
  assert.equal(cache.get("key1"), undefined);
});

test("invalidateAll() clears everything", () => {
  const cache = new SecretCache();
  cache.set("a", "1");
  cache.set("b", "2");
  cache.invalidateAll();
  assert.equal(cache.size(), 0);
});

test("size() returns correct count", () => {
  const cache = new SecretCache();
  cache.set("a", "1");
  cache.set("b", "2");
  cache.set("c", "3");
  assert.equal(cache.size(), 3);
});
