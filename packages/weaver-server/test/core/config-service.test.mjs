import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createWeaverConfigService } from "../../src/core/config-service.ts";
import { deepSet, deepRemove } from "@weaver-conf/config-engine";

function createTestProvider(id, layer, entries, writable = true) {
  let data = JSON.parse(JSON.stringify(entries));
  return {
    id,
    layer,
    writable,
    async load() { return { entries: JSON.parse(JSON.stringify(data)) }; },
    async write(key, value) {
      if (!writable) return { success: false, error: "read-only" };
      deepSet(data, key, value);
      return { success: true };
    },
    async remove(key) {
      if (!writable) return { success: false, error: "read-only" };
      deepRemove(data, key);
      return { success: true };
    },
    _setData(newData) { data = JSON.parse(JSON.stringify(newData)); },
  };
}

describe("WeaverConfigService read path", () => {
  test("resolveAll returns correct snapshot shape", async () => {
    const provider = createTestProvider("p1", "platform", { app: { name: "test" } });
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const snapshot = await svc.resolveAll();
    assert.equal(snapshot.entries.app.name, "test");
    assert.ok(snapshot.revision);
    assert.ok(snapshot.timestamp);
    assert.deepEqual(snapshot.scopes, {});
  });

  test("get returns correct value via dot-path traversal", async () => {
    const provider = createTestProvider("p1", "platform", { db: { host: "localhost" } });
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const val = await svc.get("db.host");
    assert.equal(val, "localhost");
  });

  test("getNamespace returns subtree", async () => {
    const provider = createTestProvider("p1", "platform", {
      db: { host: "localhost", port: 5432 },
      cache: { ttl: 60 },
    });
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const ns = await svc.getNamespace("db");
    assert.equal(ns.host, "localhost");
    assert.equal(ns.port, 5432);
    assert.equal(ns.ttl, undefined);
  });

  test("inspect returns provenance", async () => {
    const p1 = createTestProvider("p1", "defaults", { app: { name: "base" } });
    const p2 = createTestProvider("p2", "platform", { app: { name: "override" } });
    const svc = await createWeaverConfigService({
      providers: [p1, p2],
      environment: "dev",
    });

    const info = await svc.inspect("app.name");
    assert.equal(info.key, "app.name");
    assert.equal(info.effectiveValue, "override");
    assert.equal(info.effectiveLayer, "platform");
    assert.equal(info.layerValues["defaults"], "base");
    assert.equal(info.layerValues["platform"], "override");
  });

  test("multi-scope: platform + scoped providers grouped correctly", async () => {
    const platform = createTestProvider("p1", "platform", { app: { name: "test" } });
    const acme = createTestProvider("t1", "tenant:acme", { theme: "dark" });
    const globex = createTestProvider("t2", "tenant:globex", { theme: "light" });

    const svc = await createWeaverConfigService({
      providers: [platform, acme, globex],
      environment: "dev",
    });

    const snapshot = await svc.resolveAll();
    assert.equal(snapshot.entries.app.name, "test");
    assert.equal(snapshot.scopes["tenant:acme"]["theme"], "dark");
    assert.equal(snapshot.scopes["tenant:globex"]["theme"], "light");
  });

  test("get with scopePath merges scope over platform", async () => {
    const platform = createTestProvider("p1", "platform", { theme: "default" });
    const acme = createTestProvider("t1", "tenant:acme", { theme: "dark" });

    const svc = await createWeaverConfigService({
      providers: [platform, acme],
      environment: "dev",
    });

    const val = await svc.get("theme", { scopePath: [{ scopeId: "tenant", value: "acme" }] });
    assert.equal(val, "dark");
  });

  test("reloadProvider picks up changes", async () => {
    const provider = createTestProvider("p1", "platform", { key: "old" });
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    assert.equal(await svc.get("key"), "old");

    provider._setData({ key: "new" });
    await svc.reloadProvider("p1");

    assert.equal(await svc.get("key"), "new");
  });

  test("revision changes after reload", async () => {
    const provider = createTestProvider("p1", "platform", { key: "v1" });
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const rev1 = svc.revision;
    provider._setData({ key: "v2" });
    await svc.reloadProvider("p1");
    const rev2 = svc.revision;

    assert.notEqual(rev1, rev2);
  });

  test("setMany writes multiple entries in one batch", async () => {
    const provider = createTestProvider("p1", "platform", {});
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const result = await svc.setMany("platform", {
      "db.host": "localhost",
      "db.port": 5432,
    });
    assert.equal(result.success, true);
    assert.equal(await svc.get("db.host"), "localhost");
    assert.equal(await svc.get("db.port"), 5432);
  });
});
