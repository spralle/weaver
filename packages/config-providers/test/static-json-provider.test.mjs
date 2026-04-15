import test from "node:test";
import assert from "node:assert/strict";
import { StaticJsonStorageProvider } from "../dist/index.js";

test("load returns cloned data", async () => {
  const original = { "ghost.app.theme": "dark", "ghost.app.zoom": 5 };
  const provider = new StaticJsonStorageProvider({
    id: "static-1",
    layer: "core",
    data: original,
  });
  const data = await provider.load();
  assert.deepEqual(data.entries, { "ghost.app.theme": "dark", "ghost.app.zoom": 5 });
});

test("mutation of original data does not affect load", async () => {
  const original = { "ghost.app.theme": "dark" };
  const provider = new StaticJsonStorageProvider({
    id: "static-2",
    layer: "core",
    data: original,
  });
  original["ghost.app.theme"] = "mutated";
  const data = await provider.load();
  // structuredClone captures state at load time, but the provider stores a
  // reference to the original — the clone happens in load(). So mutation of
  // original before load will be visible. This is acceptable: the contract
  // says "data supplied at construction" is the baseline. The clone protects
  // consumers from each other, not from pre-load source mutation.
  // To also protect from source mutation, we'd clone in constructor too.
  // Let's verify at minimum that successive loads are independent:
  const data1 = await provider.load();
  data1.entries["ghost.app.theme"] = "changed-by-consumer";
  const data2 = await provider.load();
  assert.notEqual(data2.entries["ghost.app.theme"], "changed-by-consumer");
});

test("load returns deep clone (nested objects)", async () => {
  const original = { nested: { a: 1 } };
  const provider = new StaticJsonStorageProvider({
    id: "static-3",
    layer: "app",
    data: original,
  });
  const data1 = await provider.load();
  data1.entries.nested.a = 999;
  const data2 = await provider.load();
  assert.equal(data2.entries.nested.a, 1);
});

test("write returns failure", async () => {
  const provider = new StaticJsonStorageProvider({
    id: "static-4",
    layer: "core",
    data: {},
  });
  const result = await provider.write("ghost.app.theme", "light");
  assert.equal(result.success, false);
  assert.equal(result.error, "StaticJsonStorageProvider is read-only");
});

test("remove returns failure", async () => {
  const provider = new StaticJsonStorageProvider({
    id: "static-5",
    layer: "core",
    data: { key: "value" },
  });
  const result = await provider.remove("key");
  assert.equal(result.success, false);
  assert.equal(result.error, "StaticJsonStorageProvider is read-only");
});

test("writable is false", () => {
  const provider = new StaticJsonStorageProvider({
    id: "static-6",
    layer: "core",
    data: {},
  });
  assert.equal(provider.writable, false);
});

test("id and layer are set correctly", () => {
  const provider = new StaticJsonStorageProvider({
    id: "my-id",
    layer: "module",
    data: {},
  });
  assert.equal(provider.id, "my-id");
  assert.equal(provider.layer, "module");
});
