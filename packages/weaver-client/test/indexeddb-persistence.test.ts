import { createIndexedDbPersistence } from "../src/indexeddb-persistence.js";

describe("IndexedDB Persistence", () => {
  it("factory returns object with save and load methods", () => {
    const persistence = createIndexedDbPersistence();
    expect(typeof persistence.save).toBe("function");
    expect(typeof persistence.load).toBe("function");
  });

  it("accepts custom options", () => {
    const persistence = createIndexedDbPersistence({
      dbName: "custom-db",
      storeName: "custom-store",
    });
    expect(typeof persistence.save).toBe("function");
    expect(typeof persistence.load).toBe("function");
  });
});
