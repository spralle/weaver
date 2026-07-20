import { createSecretCache, SecretCache } from "../src/secret-cache.js";

describe("SecretCache", () => {
  it("stores and retrieves a value", () => {
    const cache = createSecretCache();
    cache.set("key1", "secret-value", "v1");
    const entry = cache.get("key1");
    expect(entry).toBeTruthy();
    if (!entry) {
      throw new Error("Expected cache entry");
    }
    expect(entry.value).toBe("secret-value");
    expect(entry.version).toBe("v1");
  });

  it("returns undefined for missing key", () => {
    const cache = createSecretCache();
    expect(cache.get("missing")).toBe(undefined);
  });

  it("expires entries after TTL", () => {
    const cache = new SecretCache({ defaultTtlMs: 1 });
    cache.set("key1", "val");
    // Force expiry by waiting (TTL=1ms)
    const start = Date.now();
    while (Date.now() - start < 5) {
      /* spin */
    }
    expect(cache.get("key1")).toBe(undefined);
  });

  it("evicts oldest entry when maxEntries exceeded", () => {
    const cache = new SecretCache({ maxEntries: 2 });
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    expect(cache.get("a")).toBe(undefined);
    expect(cache.get("b")).toBeTruthy();
    expect(cache.get("c")).toBeTruthy();
    expect(cache.size()).toBe(2);
  });

  it("invalidate removes a single key", () => {
    const cache = createSecretCache();
    cache.set("k", "v");
    cache.invalidate("k");
    expect(cache.get("k")).toBe(undefined);
  });

  it("invalidateAll clears everything", () => {
    const cache = createSecretCache();
    cache.set("a", "1");
    cache.set("b", "2");
    cache.invalidateAll();
    expect(cache.size()).toBe(0);
  });

  it("custom TTL per entry overrides default", () => {
    const cache = new SecretCache({ defaultTtlMs: 100_000 });
    cache.set("short", "val", undefined, 1);
    const start = Date.now();
    while (Date.now() - start < 5) {
      /* spin */
    }
    expect(cache.get("short")).toBe(undefined);
  });
});
