import { test, expect, describe } from "bun:test";
import { createLocalTransport } from "../src/local-transport.js";

const snapshot = {
  entries: { db: { host: "localhost", port: 5432 }, cache: { ttl: 300 } },
  scopes: { "tenant:t1": { feature: { x: true } }, "tenant:t1/env:prod": { feature: { y: false } } },
  revision: "rev-1",
  timestamp: "2026-01-01T00:00:00Z",
};

function makeSnapshot() {
  return JSON.parse(JSON.stringify(snapshot));
}

describe("LocalTransport", () => {
  test("resolveAll returns provided snapshot", async () => {
    const t = createLocalTransport({ snapshot: makeSnapshot() });
    const result = await t.resolveAll();
    expect(result).toEqual(snapshot);
  });

  test("get returns correct value", async () => {
    const t = createLocalTransport({ snapshot: makeSnapshot() });
    expect(await t.get("db.host")).toBe("localhost");
    expect(await t.get("feature.x", { scopePath: [{ scopeId: "tenant", value: "t1" }] })).toBe(true);
  });

  test("getNamespace returns subtree", async () => {
    const t = createLocalTransport({ snapshot: makeSnapshot() });
    const ns = await t.getNamespace("db");
    expect(ns).toEqual({ host: "localhost", port: 5432 });
  });

  test("subscribe + pushDelta fires handler", () => {
    const t = createLocalTransport({ snapshot: makeSnapshot() });
    const received = [];
    t.subscribe((delta) => received.push(delta));
    const delta = { action: "set", key: "db.host", value: "newhost", layer: "platform", environment: "prod", timestamp: "t1" };
    t.pushDelta(delta);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(delta);
  });

  test("close is safe to call multiple times", async () => {
    const t = createLocalTransport({ snapshot: makeSnapshot() });
    await t.close();
    await t.close();
  });

  test("inspect returns key info", async () => {
    const t = createLocalTransport({ snapshot: makeSnapshot() });
    const info = await t.inspect("db.host");
    expect(info).toEqual({ key: "db.host", value: "localhost", source: "local" });
  });

  test("set writes a value readable via get", async () => {
    const t = createLocalTransport({ snapshot: makeSnapshot() });
    const result = await t.set("new.key", 42);
    expect(result.success).toBe(true);
    expect(result.revision).toBeDefined();
    expect(await t.get("new.key")).toBe(42);
  });

  test("remove deletes a value", async () => {
    const t = createLocalTransport({ snapshot: makeSnapshot() });
    expect(await t.get("db.host")).toBe("localhost");
    const result = await t.remove("db.host");
    expect(result.success).toBe(true);
    expect(await t.get("db.host")).toBeUndefined();
  });

  test("listScopes returns scope definitions from snapshot", async () => {
    const t = createLocalTransport({ snapshot: makeSnapshot() });
    const scopes = await t.listScopes();
    const ids = scopes.map(s => s.id).sort();
    expect(ids).toEqual(["env", "tenant"]);
    expect(scopes[0]).toHaveProperty("label");
  });

  test("listScopeValues returns values for a scope", async () => {
    const t = createLocalTransport({ snapshot: makeSnapshot() });
    const values = await t.listScopeValues("tenant");
    expect(values).toEqual(["t1"]);
    const envValues = await t.listScopeValues("env");
    expect(envValues).toEqual(["prod"]);
  });

  test("setMany writes multiple entries", async () => {
    const t = createLocalTransport({ snapshot: makeSnapshot() });
    const result = await t.setMany({ "cache.ttl": 600, "cache.max": 1000 });
    expect(result.success).toBe(true);
    expect(await t.get("cache.ttl")).toBe(600);
    expect(await t.get("cache.max")).toBe(1000);
  });
});
