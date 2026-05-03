import { test, expect, describe } from "bun:test";
import { createTenantManager } from "../src/tenant-manager.js";

function createMockSnapshot() {
  return {
    platform: { "db.host": "localhost" },
    tenants: {
      "tenant-a": { "feature.x": true },
      "tenant-b": { "feature.y": "hello" },
    },
    revision: "rev-001",
    timestamp: "2026-01-01T00:00:00Z",
  };
}

function createMockTransport(snapshot = createMockSnapshot()) {
  return {
    async resolveAll() { return snapshot; },
    async get() { return undefined; },
    async getNamespace() { return {}; },
    subscribe() { return () => {}; },
    async close() {},
  };
}

describe("TenantManager", () => {
  test("eager mode: all tenants loaded immediately", () => {
    const tm = createTenantManager({
      mode: "eager",
      transport: createMockTransport(),
      serviceId: "svc",
      initialSnapshot: createMockSnapshot(),
    });
    expect(tm.getTenantState("tenant-a")).toEqual({ "feature.x": true });
    expect(tm.getTenantState("tenant-b")).toEqual({ "feature.y": "hello" });
    expect(tm.loadedTenants.size).toBe(2);
  });

  test("lazy mode: tenant not loaded until warmTenant called", () => {
    const tm = createTenantManager({
      mode: "lazy",
      transport: createMockTransport(),
      serviceId: "svc",
      initialSnapshot: createMockSnapshot(),
    });
    expect(tm.getTenantState("tenant-a")).toBeUndefined();
    expect(tm.loadedTenants.size).toBe(0);
  });

  test("lazy mode: warmTenant loads and caches", async () => {
    const tm = createTenantManager({
      mode: "lazy",
      transport: createMockTransport(),
      serviceId: "svc",
      initialSnapshot: createMockSnapshot(),
    });
    await tm.warmTenant("tenant-a");
    expect(tm.getTenantState("tenant-a")).toEqual({ "feature.x": true });
    expect(tm.loadedTenants.has("tenant-a")).toBe(true);
  });

  test("hot mode: snapshot tenants loaded, others lazy", () => {
    const tm = createTenantManager({
      mode: "hot",
      transport: createMockTransport(),
      serviceId: "svc",
      initialSnapshot: createMockSnapshot(),
    });
    expect(tm.getTenantState("tenant-a")).toEqual({ "feature.x": true });
    expect(tm.getTenantState("unknown")).toBeUndefined();
  });

  test("applyDelta updates correct tenant state", () => {
    const tm = createTenantManager({
      mode: "eager",
      transport: createMockTransport(),
      serviceId: "svc",
      initialSnapshot: createMockSnapshot(),
    });
    tm.applyDelta({ action: "set", key: "feature.x", value: false, layer: "tenant-a", environment: "prod", timestamp: "t1" }, "tenant-a");
    expect(tm.getTenantState("tenant-a")["feature.x"]).toBe(false);
  });

  test("loadedTenants tracks which tenants are loaded", async () => {
    const tm = createTenantManager({
      mode: "lazy",
      transport: createMockTransport(),
      serviceId: "svc",
      initialSnapshot: createMockSnapshot(),
    });
    expect(tm.loadedTenants.size).toBe(0);
    await tm.warmTenant("tenant-b");
    expect(tm.loadedTenants.has("tenant-b")).toBe(true);
    expect(tm.loadedTenants.size).toBe(1);
  });
});
