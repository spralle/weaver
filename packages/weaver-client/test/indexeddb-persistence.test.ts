import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createIndexedDbPersistence } from "../src/indexeddb-persistence.js";

describe("IndexedDB Persistence", () => {
  it("factory returns object with save and load methods", () => {
    const persistence = createIndexedDbPersistence();
    assert.equal(typeof persistence.save, "function");
    assert.equal(typeof persistence.load, "function");
  });

  it("accepts custom options", () => {
    const persistence = createIndexedDbPersistence({
      dbName: "custom-db",
      storeName: "custom-store",
    });
    assert.equal(typeof persistence.save, "function");
    assert.equal(typeof persistence.load, "function");
  });
});
