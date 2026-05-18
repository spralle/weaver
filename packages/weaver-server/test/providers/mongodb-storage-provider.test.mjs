import test from "node:test";
import assert from "node:assert/strict";
import { createMongoDBStorageProvider } from "../../src/providers/mongodb-storage-provider.ts";

function createMockCollection() {
  const docs = [];

  return {
    docs,
    find(filter) {
      const results = docs.filter(
        (d) => d.layer === filter.layer && d.environment === filter.environment,
      );
      return {
        maxTimeMS() { return this; },
        toArray: () => Promise.resolve(results),
      };
    },
    async updateOne(filter, update, options) {
      const idx = docs.findIndex(
        (d) => d.layer === filter.layer && d.environment === filter.environment && d.key === filter.key,
      );
      if (idx >= 0) {
        Object.assign(docs[idx], update.$set);
      } else if (options?.upsert) {
        docs.push({ ...filter, ...update.$set });
      }
    },
    async deleteOne(filter) {
      const idx = docs.findIndex(
        (d) => d.layer === filter.layer && d.environment === filter.environment && d.key === filter.key,
      );
      if (idx >= 0) docs.splice(idx, 1);
    },
  };
}

test("load() returns entries from collection", async () => {
  const col = createMockCollection();
  col.docs.push(
    { layer: "user", environment: "prod", key: "theme", value: "dark", updatedAt: "2024-01-01" },
    { layer: "user", environment: "prod", key: "lang", value: "en", updatedAt: "2024-01-01" },
    { layer: "other", environment: "prod", key: "x", value: 1, updatedAt: "2024-01-01" },
  );

  const provider = createMongoDBStorageProvider({
    id: "mongo-user",
    layer: "user",
    collection: col,
    environment: "prod",
  });

  const data = await provider.load();
  assert.deepEqual(data.entries, { theme: "dark", lang: "en" });
});

test("write() upserts document", async () => {
  const col = createMockCollection();
  const provider = createMongoDBStorageProvider({
    id: "mongo-user",
    layer: "user",
    collection: col,
    environment: "prod",
  });

  const result = await provider.write("theme", "light");
  assert.equal(result.success, true);
  assert.equal(col.docs.length, 1);
  assert.equal(col.docs[0].value, "light");

  // Upsert overwrites
  await provider.write("theme", "dark");
  assert.equal(col.docs.length, 1);
  assert.equal(col.docs[0].value, "dark");
});

test("remove() deletes document", async () => {
  const col = createMockCollection();
  col.docs.push({ layer: "user", environment: "prod", key: "theme", value: "dark", updatedAt: "x" });

  const provider = createMongoDBStorageProvider({
    id: "mongo-user",
    layer: "user",
    collection: col,
    environment: "prod",
  });

  const result = await provider.remove("theme");
  assert.equal(result.success, true);
  assert.equal(col.docs.length, 0);
});

test("read-only provider rejects writes", async () => {
  const col = createMockCollection();
  const provider = createMongoDBStorageProvider({
    id: "mongo-user",
    layer: "user",
    collection: col,
    environment: "prod",
    writable: false,
  });

  const result = await provider.write("x", 1);
  assert.equal(result.success, false);
});

test("load() throws with descriptive error when collection fails", async () => {
  const col = createMockCollection();
  col.find = () => ({
    maxTimeMS() { return this; },
    toArray: () => Promise.reject(new Error("connection timed out")),
  });

  const provider = createMongoDBStorageProvider({
    id: "mongo-user",
    layer: "user",
    collection: col,
    environment: "prod",
    logger: { info() {}, warn() {}, error() {}, debug() {} },
  });

  await assert.rejects(
    () => provider.load(),
    (err) => {
      assert.match(err.message, /MongoDB load failed/);
      assert.match(err.message, /connection timed out/);
      return true;
    },
  );
});

test("write() returns error result when collection fails", async () => {
  const col = createMockCollection();
  col.updateOne = () => Promise.reject(new Error("write timeout"));

  const provider = createMongoDBStorageProvider({
    id: "mongo-user",
    layer: "user",
    collection: col,
    environment: "prod",
  });

  const result = await provider.write("key", "val");
  assert.equal(result.success, false);
  assert.match(result.error, /write timeout/);
});
