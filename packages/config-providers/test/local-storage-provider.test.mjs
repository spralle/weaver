import test from "node:test";
import assert from "node:assert/strict";
import { LocalStorageProvider } from "../dist/index.js";

/**
 * Creates a minimal Storage-compatible object backed by a Map.
 * Used as a test double for browser localStorage.
 */
function createMapStorage() {
  const store = new Map();
  return {
    getItem(key) {
      const val = store.get(key);
      return val !== undefined ? val : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
  };
}

test("load returns empty entries for empty storage", async () => {
  const storage = createMapStorage();
  const provider = new LocalStorageProvider({
    id: "ls-1",
    layer: "user",
    storageKey: "ghost-config",
    storage,
  });
  const data = await provider.load();
  assert.deepEqual(data.entries, {});
});

test("load returns existing data from storage", async () => {
  const storage = createMapStorage();
  storage.setItem("ghost-config", JSON.stringify({ theme: "dark" }));
  const provider = new LocalStorageProvider({
    id: "ls-2",
    layer: "user",
    storageKey: "ghost-config",
    storage,
  });
  const data = await provider.load();
  assert.deepEqual(data.entries, { theme: "dark" });
});

test("load handles corrupt JSON gracefully", async () => {
  const storage = createMapStorage();
  storage.setItem("ghost-config", "not valid json{{{");
  const provider = new LocalStorageProvider({
    id: "ls-3",
    layer: "user",
    storageKey: "ghost-config",
    storage,
  });
  const data = await provider.load();
  assert.deepEqual(data.entries, {});
});

test("load handles non-object JSON gracefully", async () => {
  const storage = createMapStorage();
  storage.setItem("ghost-config", JSON.stringify([1, 2, 3]));
  const provider = new LocalStorageProvider({
    id: "ls-4",
    layer: "user",
    storageKey: "ghost-config",
    storage,
  });
  const data = await provider.load();
  assert.deepEqual(data.entries, {});
});

test("write adds entry and persists", async () => {
  const storage = createMapStorage();
  const provider = new LocalStorageProvider({
    id: "ls-5",
    layer: "user",
    storageKey: "ghost-config",
    storage,
  });
  const result = await provider.write("theme", "light");
  assert.equal(result.success, true);
  const data = await provider.load();
  assert.equal(data.entries.theme, "light");
});

test("write persists across load calls", async () => {
  const storage = createMapStorage();
  const provider = new LocalStorageProvider({
    id: "ls-6",
    layer: "device",
    storageKey: "ghost-device",
    storage,
  });
  await provider.write("a", 1);
  await provider.write("b", 2);

  // Create a new provider reading the same storage key
  const provider2 = new LocalStorageProvider({
    id: "ls-6b",
    layer: "device",
    storageKey: "ghost-device",
    storage,
  });
  const data = await provider2.load();
  assert.equal(data.entries.a, 1);
  assert.equal(data.entries.b, 2);
});

test("write handles QuotaExceededError", async () => {
  const storage = createMapStorage();
  const originalSetItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === "ghost-config") {
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    }
    originalSetItem(key, value);
  };
  const provider = new LocalStorageProvider({
    id: "ls-7",
    layer: "user",
    storageKey: "ghost-config",
    storage,
  });
  const result = await provider.write("key", "value");
  assert.equal(result.success, false);
  assert.ok(result.error);
});

test("remove deletes entry", async () => {
  const storage = createMapStorage();
  storage.setItem("ghost-config", JSON.stringify({ a: 1, b: 2 }));
  const provider = new LocalStorageProvider({
    id: "ls-8",
    layer: "user",
    storageKey: "ghost-config",
    storage,
  });
  const result = await provider.remove("a");
  assert.equal(result.success, true);
  const data = await provider.load();
  assert.equal(data.entries.a, undefined);
  assert.equal(data.entries.b, 2);
});

test("writable is true", () => {
  const storage = createMapStorage();
  const provider = new LocalStorageProvider({
    id: "ls-9",
    layer: "user",
    storageKey: "ghost-config",
    storage,
  });
  assert.equal(provider.writable, true);
});

test("onExternalChange returns cleanup function in Node", () => {
  const storage = createMapStorage();
  const provider = new LocalStorageProvider({
    id: "ls-10",
    layer: "user",
    storageKey: "ghost-config",
    storage,
  });
  // In Node.js, globalThis.addEventListener may not exist for storage events.
  // The method should not crash and should return a cleanup function.
  const cleanup = provider.onExternalChange(() => {});
  assert.equal(typeof cleanup, "function");
  cleanup(); // Should not throw
});
