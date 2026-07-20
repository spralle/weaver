import { SecretCache } from "../dist/index.js";

test("SecretCache can be instantiated", () => {
  const cache = new SecretCache();
  expect(cache.size()).toBe(0);
});

test("get() returns undefined for unknown key", () => {
  const cache = new SecretCache();
  expect(cache.get("unknown")).toBe(undefined);
});

test("set() + get() round-trips", () => {
  const cache = new SecretCache();
  cache.set("key1", "secret-value", "v1");
  const entry = cache.get("key1");
  expect(entry?.value).toBe("secret-value");
  expect(entry?.version).toBe("v1");
});

test("expired entries return undefined", async () => {
  const cache = new SecretCache({ defaultTtlMs: 10 });
  cache.set("key1", "value");
  await new Promise((r) => setTimeout(r, 20));
  expect(cache.get("key1")).toBe(undefined);
});

test("invalidate() removes an entry", () => {
  const cache = new SecretCache();
  cache.set("key1", "value");
  cache.invalidate("key1");
  expect(cache.get("key1")).toBe(undefined);
});

test("invalidateAll() clears everything", () => {
  const cache = new SecretCache();
  cache.set("a", "1");
  cache.set("b", "2");
  cache.invalidateAll();
  expect(cache.size()).toBe(0);
});

test("size() returns correct count", () => {
  const cache = new SecretCache();
  cache.set("a", "1");
  cache.set("b", "2");
  cache.set("c", "3");
  expect(cache.size()).toBe(3);
});

// --- TTL behavior ---

test("TTL=0 means entry expires immediately", () => {
  const cache = new SecretCache({ defaultTtlMs: 0 });
  cache.set("key1", "value");
  // expiresAt = now + 0, so Date.now() >= expiresAt is true immediately
  expect(cache.get("key1")).toBe(undefined);
});

test("very short TTL (1ms) entry expires after delay", async () => {
  const cache = new SecretCache({ defaultTtlMs: 1 });
  cache.set("key1", "value");
  await new Promise((r) => setTimeout(r, 10));
  expect(cache.get("key1")).toBe(undefined);
});

test("custom TTL per entry overrides default cache TTL", async () => {
  const cache = new SecretCache({ defaultTtlMs: 5 });
  cache.set("short", "val1");
  cache.set("long", "val2", undefined, 5000);
  await new Promise((r) => setTimeout(r, 15));
  expect(cache.get("short")).toBe(undefined);
  expect(cache.get("long")).not.toBe(undefined);
  expect(cache.get("long")?.value).toBe("val2");
});

// --- Edge cases ---

test("set() with same key overwrites previous value", () => {
  const cache = new SecretCache();
  cache.set("key1", "old");
  cache.set("key1", "new");
  expect(cache.get("key1")?.value).toBe("new");
});

test("set() with same key resets TTL timer", async () => {
  const cache = new SecretCache({ defaultTtlMs: 100 });
  cache.set("key1", "val");
  await new Promise((r) => setTimeout(r, 60));
  cache.set("key1", "val2");
  await new Promise((r) => setTimeout(r, 60));
  // Should still be alive since TTL was reset (100ms from second set)
  expect(cache.get("key1")).not.toBe(undefined);
});

test("get() after invalidate() returns undefined", () => {
  const cache = new SecretCache();
  cache.set("key1", "value");
  cache.invalidate("key1");
  expect(cache.get("key1")).toBe(undefined);
});

test("invalidateAll() with empty cache does not throw", () => {
  const cache = new SecretCache();
  expect(() => cache.invalidateAll()).not.toThrow();
});

test("size() returns 0 after invalidateAll()", () => {
  const cache = new SecretCache();
  cache.set("a", "1");
  cache.set("b", "2");
  cache.invalidateAll();
  expect(cache.size()).toBe(0);
});

test("set() then get() for multiple different keys", () => {
  const cache = new SecretCache();
  cache.set("k1", "v1");
  cache.set("k2", "v2");
  cache.set("k3", "v3");
  expect(cache.get("k1")?.value).toBe("v1");
  expect(cache.get("k2")?.value).toBe("v2");
  expect(cache.get("k3")?.value).toBe("v3");
});

test("large number of entries (100+) still works", () => {
  const cache = new SecretCache({ maxEntries: 200 });
  for (let i = 0; i < 150; i++) {
    cache.set(`key-${i}`, `val-${i}`);
  }
  expect(cache.size()).toBe(150);
  expect(cache.get("key-0")?.value).toBe("val-0");
  expect(cache.get("key-149")?.value).toBe("val-149");
});
