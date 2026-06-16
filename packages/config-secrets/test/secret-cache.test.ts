import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSecretCache, SecretCache } from "../src/secret-cache.js";

describe("SecretCache", () => {
  it("stores and retrieves a value", () => {
    const cache = createSecretCache();
    cache.set("key1", "secret-value", "v1");
    const entry = cache.get("key1");
    assert.ok(entry);
    assert.equal(entry.value, "secret-value");
    assert.equal(entry.version, "v1");
  });

  it("returns undefined for missing key", () => {
    const cache = createSecretCache();
    assert.equal(cache.get("missing"), undefined);
  });

  it("expires entries after TTL", () => {
    const cache = new SecretCache({ defaultTtlMs: 1 });
    cache.set("key1", "val");
    // Force expiry by waiting (TTL=1ms)
    const start = Date.now();
    while (Date.now() - start < 5) {
      /* spin */
    }
    assert.equal(cache.get("key1"), undefined);
  });

  it("evicts oldest entry when maxEntries exceeded", () => {
    const cache = new SecretCache({ maxEntries: 2 });
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    assert.equal(cache.get("a"), undefined);
    assert.ok(cache.get("b"));
    assert.ok(cache.get("c"));
    assert.equal(cache.size(), 2);
  });

  it("invalidate removes a single key", () => {
    const cache = createSecretCache();
    cache.set("k", "v");
    cache.invalidate("k");
    assert.equal(cache.get("k"), undefined);
  });

  it("invalidateAll clears everything", () => {
    const cache = createSecretCache();
    cache.set("a", "1");
    cache.set("b", "2");
    cache.invalidateAll();
    assert.equal(cache.size(), 0);
  });

  it("custom TTL per entry overrides default", () => {
    const cache = new SecretCache({ defaultTtlMs: 100_000 });
    cache.set("short", "val", undefined, 1);
    const start = Date.now();
    while (Date.now() - start < 5) {
      /* spin */
    }
    assert.equal(cache.get("short"), undefined);
  });
});
