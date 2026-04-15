import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryStorageProvider } from "../dist/index.js";

test("constructs with default empty entries", async () => {
  const provider = new InMemoryStorageProvider({
    id: "mem-1",
    layer: "session",
  });
  const data = await provider.load();
  assert.deepEqual(data.entries, {});
});

test("constructs with initial entries", async () => {
  const provider = new InMemoryStorageProvider({
    id: "mem-2",
    layer: "session",
    initialEntries: { "ghost.app.theme": "dark" },
  });
  const data = await provider.load();
  assert.deepEqual(data.entries, { "ghost.app.theme": "dark" });
});

test("load returns a snapshot (not a live reference)", async () => {
  const provider = new InMemoryStorageProvider({
    id: "mem-3",
    layer: "session",
    initialEntries: { key: "value" },
  });
  const data1 = await provider.load();
  data1.entries.key = "mutated";
  const data2 = await provider.load();
  assert.equal(data2.entries.key, "value");
});

test("write adds entries", async () => {
  const provider = new InMemoryStorageProvider({
    id: "mem-4",
    layer: "session",
  });
  const result = await provider.write("ghost.app.zoom", 5);
  assert.equal(result.success, true);
  const data = await provider.load();
  assert.equal(data.entries["ghost.app.zoom"], 5);
});

test("write overwrites existing entries", async () => {
  const provider = new InMemoryStorageProvider({
    id: "mem-5",
    layer: "session",
    initialEntries: { key: "old" },
  });
  await provider.write("key", "new");
  const data = await provider.load();
  assert.equal(data.entries.key, "new");
});

test("remove deletes entries", async () => {
  const provider = new InMemoryStorageProvider({
    id: "mem-6",
    layer: "session",
    initialEntries: { a: 1, b: 2 },
  });
  const result = await provider.remove("a");
  assert.equal(result.success, true);
  const data = await provider.load();
  assert.equal(data.entries.a, undefined);
  assert.equal(data.entries.b, 2);
});

test("remove on non-existent key succeeds", async () => {
  const provider = new InMemoryStorageProvider({
    id: "mem-7",
    layer: "session",
  });
  const result = await provider.remove("missing");
  assert.equal(result.success, true);
});

test("writable is true", () => {
  const provider = new InMemoryStorageProvider({
    id: "mem-8",
    layer: "session",
  });
  assert.equal(provider.writable, true);
});

test("id and layer are set correctly", () => {
  const provider = new InMemoryStorageProvider({
    id: "test-id",
    layer: "device",
  });
  assert.equal(provider.id, "test-id");
  assert.equal(provider.layer, "device");
});
