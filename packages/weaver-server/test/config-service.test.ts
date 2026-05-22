import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createWeaverConfigService } from "../src/core/config-service.js";
import { createInMemoryStorageProvider } from "@weaver-conf/storage-providers";

describe("WeaverConfigService", () => {
  async function makeService(entries: Record<string, unknown> = {}) {
    const provider = createInMemoryStorageProvider({
      id: "mem-app",
      layer: "app",
      initialEntries: entries,
    });
    return createWeaverConfigService({
      providers: [provider],
      environment: "test",
    });
  }

  it("resolves all entries", async () => {
    const svc = await makeService({ "app.name": "weaver", "app.port": 8080 });
    const snapshot = await svc.resolveAll();
    assert.equal(snapshot.entries["app.name"], "weaver");
    assert.equal(snapshot.entries["app.port"], 8080);
    assert.ok(snapshot.revision);
  });

  it("gets a single key", async () => {
    const svc = await makeService({ db: { host: "localhost" } });
    const val = await svc.get("db.host");
    assert.equal(val, "localhost");
  });

  it("returns undefined for missing key", async () => {
    const svc = await makeService({});
    const val = await svc.get("missing.key");
    assert.equal(val, undefined);
  });

  it("sets a value and updates revision", async () => {
    const svc = await makeService({});
    const oldRev = svc.revision;
    const result = await svc.set("app", "new.key", "value");
    assert.equal(result.success, true);
    const val = await svc.get("new.key");
    assert.equal(val, "value");
    assert.notEqual(svc.revision, oldRev);
  });

  it("removes a value", async () => {
    const svc = await makeService({ "rm.key": "gone" });
    const result = await svc.remove("app", "rm.key");
    assert.equal(result.success, true);
    const val = await svc.get("rm.key");
    assert.equal(val, undefined);
  });

  it("fires delta on set", async () => {
    const svc = await makeService({});
    const deltas: unknown[] = [];
    svc.onDelta((d) => deltas.push(d));
    await svc.set("app", "x", 1);
    assert.equal(deltas.length, 1);
  });

  it("rejects write with stale revision", async () => {
    const svc = await makeService({});
    const result = await svc.set("app", "k", "v", { expectedRevision: "stale-rev" });
    assert.equal(result.success, false);
  });

  it("handles degraded providers gracefully", async () => {
    const badProvider = {
      id: "bad",
      layer: "core",
      writable: false as const,
      async load() { throw new Error("connection failed"); },
    };
    const goodProvider = createInMemoryStorageProvider({
      id: "good",
      layer: "app",
      initialEntries: { "k": "v" },
    });
    const svc = await createWeaverConfigService({
      providers: [badProvider, goodProvider],
      environment: "test",
    });
    assert.deepEqual(svc.degradedProviders, ["bad"]);
    const val = await svc.get("k");
    assert.equal(val, "v");
  });

  it("getNamespace returns nested object at prefix", async () => {
    const svc = await makeService({ app: { name: "w", port: 3000 }, db: { host: "x" } });
    const ns = await svc.getNamespace("app");
    assert.equal(ns["name"], "w");
    assert.equal(ns["port"], 3000);
  });
});
