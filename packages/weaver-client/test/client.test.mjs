import { test, expect, describe } from "bun:test";
import { createWeaverClient } from "../src/client.js";

function createMockSnapshot() {
  return {
    platform: { "db.host": "localhost", "db.port": 5432, "cache.ttl": 300 },
    tenants: {
      "tenant-a": { "feature.x": true, "feature.y": false },
      "tenant-b": { "feature.x": false },
    },
    revision: "rev-001",
    timestamp: "2026-01-01T00:00:00Z",
  };
}

function createMockTransport(snapshot = createMockSnapshot()) {
  const subscribers = new Set();
  return {
    transport: {
      async resolveAll() { return snapshot; },
      async get(_sid, key, opts) {
        const src = opts?.tenantId ? snapshot.tenants[opts.tenantId] ?? {} : snapshot.platform;
        return src[key];
      },
      async getNamespace(_sid, prefix, opts) {
        const src = opts?.tenantId ? snapshot.tenants[opts.tenantId] ?? {} : snapshot.platform;
        const result = {};
        for (const [k, v] of Object.entries(src)) {
          if (k.startsWith(prefix)) result[k] = v;
        }
        return result;
      },
      subscribe(_sid, handler) {
        subscribers.add(handler);
        return () => subscribers.delete(handler);
      },
      async close() { subscribers.clear(); },
    },
    pushDelta(delta) {
      for (const h of subscribers) h(delta);
    },
  };
}

describe("createWeaverClient", () => {
  test("initializes and provides sync get()", async () => {
    const { transport } = createMockTransport();
    const client = await createWeaverClient({ serviceId: "svc", transport });
    expect(client.get("db.host")).toBe("localhost");
    expect(client.revision).toBe("rev-001");
    expect(client.connected).toBe(true);
    await client.close();
  });

  test("get() returns correct platform values", async () => {
    const { transport } = createMockTransport();
    const client = await createWeaverClient({ serviceId: "svc", transport });
    expect(client.get("db.port")).toBe(5432);
    expect(client.get("nonexistent")).toBeUndefined();
    await client.close();
  });

  test("get() with tenantId returns tenant-scoped values", async () => {
    const { transport } = createMockTransport();
    const client = await createWeaverClient({ serviceId: "svc", transport, tenantMode: "eager" });
    expect(client.get("feature.x", { tenantId: "tenant-a" })).toBe(true);
    expect(client.get("feature.x", { tenantId: "tenant-b" })).toBe(false);
    await client.close();
  });

  test("getNamespace() returns filtered keys", async () => {
    const { transport } = createMockTransport();
    const client = await createWeaverClient({ serviceId: "svc", transport });
    const ns = client.getNamespace("db.");
    expect(ns).toEqual({ "db.host": "localhost", "db.port": 5432 });
    await client.close();
  });

  test("onChange() fires when matching deltas arrive", async () => {
    const { transport, pushDelta } = createMockTransport();
    const client = await createWeaverClient({ serviceId: "svc", transport });
    const received = [];
    client.onChange("db.*", (changes) => received.push(...changes));
    pushDelta({ action: "set", key: "db.host", value: "newhost", layer: "platform", environment: "prod", timestamp: "t1" });
    expect(received).toHaveLength(1);
    expect(received[0].value).toBe("newhost");
    // Non-matching delta should not fire
    pushDelta({ action: "set", key: "cache.ttl", value: 600, layer: "platform", environment: "prod", timestamp: "t2" });
    expect(received).toHaveLength(1);
    await client.close();
  });

  test("warmTenant() loads tenant state", async () => {
    const { transport } = createMockTransport();
    const client = await createWeaverClient({ serviceId: "svc", transport, tenantMode: "lazy" });
    expect(client.get("feature.x", { tenantId: "tenant-a" })).toBeUndefined();
    await client.warmTenant("tenant-a");
    expect(client.get("feature.x", { tenantId: "tenant-a" })).toBe(true);
    await client.close();
  });

  test("close() unsubscribes and closes transport", async () => {
    const { transport, pushDelta } = createMockTransport();
    const client = await createWeaverClient({ serviceId: "svc", transport });
    await client.close();
    expect(client.connected).toBe(false);
  });
});
