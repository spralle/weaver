import { createLocalStorageProvider } from "../src/local-storage-provider.ts";

/**
 * Creates a minimal Storage-compatible object backed by a Map.
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
  const provider = createLocalStorageProvider({
    id: "ls-1",
    layer: "user",
    storageKey: "weaver-config",
    storage,
  });
  const data = await provider.load();
  expect(data.entries).toEqual({});
});

test("load returns existing data from storage", async () => {
  const storage = createMapStorage();
  storage.setItem("weaver-config", JSON.stringify({ theme: "dark" }));
  const provider = createLocalStorageProvider({
    id: "ls-2",
    layer: "user",
    storageKey: "weaver-config",
    storage,
  });
  const data = await provider.load();
  expect(data.entries).toEqual({ theme: "dark" });
});

test("load handles corrupt JSON gracefully", async () => {
  const storage = createMapStorage();
  storage.setItem("weaver-config", "not valid json{{{");
  const provider = createLocalStorageProvider({
    id: "ls-3",
    layer: "user",
    storageKey: "weaver-config",
    storage,
  });
  const data = await provider.load();
  expect(data.entries).toEqual({});
});

test("load handles non-object JSON gracefully", async () => {
  const storage = createMapStorage();
  storage.setItem("weaver-config", JSON.stringify([1, 2, 3]));
  const provider = createLocalStorageProvider({
    id: "ls-4",
    layer: "user",
    storageKey: "weaver-config",
    storage,
  });
  const data = await provider.load();
  expect(data.entries).toEqual({});
});

test("write adds entry and persists", async () => {
  const storage = createMapStorage();
  const provider = createLocalStorageProvider({
    id: "ls-5",
    layer: "user",
    storageKey: "weaver-config",
    storage,
  });
  const result = await provider.write("theme", "light");
  expect(result.success).toBe(true);
  const data = await provider.load();
  expect(data.entries.theme).toBe("light");
});

test("write persists across load calls", async () => {
  const storage = createMapStorage();
  const provider = createLocalStorageProvider({
    id: "ls-6",
    layer: "device",
    storageKey: "weaver-device",
    storage,
  });
  await provider.write("a", 1);
  await provider.write("b", 2);

  const provider2 = createLocalStorageProvider({
    id: "ls-6b",
    layer: "device",
    storageKey: "weaver-device",
    storage,
  });
  const data = await provider2.load();
  expect(data.entries.a).toBe(1);
  expect(data.entries.b).toBe(2);
});

test("write handles QuotaExceededError", async () => {
  const storage = createMapStorage();
  const originalSetItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === "weaver-config") {
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    }
    originalSetItem(key, value);
  };
  const provider = createLocalStorageProvider({
    id: "ls-7",
    layer: "user",
    storageKey: "weaver-config",
    storage,
  });
  const result = await provider.write("key", "value");
  expect(result.success).toBe(false);
  expect(result.error).toBeTruthy();
});

test("remove deletes entry", async () => {
  const storage = createMapStorage();
  storage.setItem("weaver-config", JSON.stringify({ a: 1, b: 2 }));
  const provider = createLocalStorageProvider({
    id: "ls-8",
    layer: "user",
    storageKey: "weaver-config",
    storage,
  });
  const result = await provider.remove("a");
  expect(result.success).toBe(true);
  const data = await provider.load();
  expect(data.entries.a).toBe(undefined);
  expect(data.entries.b).toBe(2);
});

test("writable is true", () => {
  const storage = createMapStorage();
  const provider = createLocalStorageProvider({
    id: "ls-9",
    layer: "user",
    storageKey: "weaver-config",
    storage,
  });
  expect(provider.writable).toBe(true);
});

test("onExternalChange returns cleanup function in Node", () => {
  const storage = createMapStorage();
  const provider = createLocalStorageProvider({
    id: "ls-10",
    layer: "user",
    storageKey: "weaver-config",
    storage,
  });
  const cleanup = provider.onExternalChange(() => {});
  expect(typeof cleanup).toBe("function");
  cleanup();
});
