import { test, expect, describe } from "bun:test";
import { createWeaverClient } from "../src/client.js";

function createMockSnapshot() {
  return {
    entries: { "db.host": "localhost", "db.port": 5432, "cache.ttl": 300 },
    scopes: {
      "tenant:tenant-a": { "feature.x": true, "feature.y": false },
      "tenant:tenant-b": { "feature.x": false },
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
      async get(key, opts) {
        const scopeKey = opts?.scopePath?.map(s => `${s.scopeId}:${s.value}`).join("/");
        const src = scopeKey ? snapshot.scopes[scopeKey] ?? {} : snapshot.entries;
        return src[key];
      },
      async getNamespace(prefix, opts) {
        const scopeKey = opts?.scopePath?.map(s => `${s.scopeId}:${s.value}`).join("/");
        const src = scopeKey ? snapshot.scopes[scopeKey] ?? {} : snapshot.entries;
        const result = {};
        for (const [k, v] of Object.entries(src)) {
          if (k.startsWith(prefix)) result[k] = v;
        }
        return result;
      },
      subscribe(handler) {
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
    const client = await createWeaverClient({ transport });
    expect(client.get("db.host")).toBe("localhost");
    expect(client.revision).toBe("rev-001");
    expect(client.connected).toBe(true);
    await client.close();
  });

  test("get() returns correct base values", async () => {
    const { transport } = createMockTransport();
    const client = await createWeaverClient({ transport });
    expect(client.get("db.port")).toBe(5432);
    expect(client.get("nonexistent")).toBeUndefined();
    await client.close();
  });

  test("get() with scopePath returns scope-specific values", async () => {
    const { transport } = createMockTransport();
    const client = await createWeaverClient({ transport, scopeLoading: "eager" });
    const scopeA = [{ scopeId: "tenant", value: "tenant-a" }];
    const scopeB = [{ scopeId: "tenant", value: "tenant-b" }];
    expect(client.get("feature.x", { scopePath: scopeA })).toBe(true);
    expect(client.get("feature.x", { scopePath: scopeB })).toBe(false);
    await client.close();
  });

  test("getNamespace() returns filtered keys", async () => {
    const { transport } = createMockTransport();
    const client = await createWeaverClient({ transport });
    const ns = client.getNamespace("db.");
    expect(ns).toEqual({ "db.host": "localhost", "db.port": 5432 });
    await client.close();
  });

  test("onChange() fires when matching deltas arrive", async () => {
    const { transport, pushDelta } = createMockTransport();
    const client = await createWeaverClient({ transport });
    const received = [];
    client.onChange("db.*", (changes) => received.push(...changes));
    pushDelta({ action: "set", key: "db.host", value: "newhost", layer: "platform", environment: "prod", timestamp: "t1" });
    expect(received).toHaveLength(1);
    expect(received[0].value).toBe("newhost");
    pushDelta({ action: "set", key: "cache.ttl", value: 600, layer: "platform", environment: "prod", timestamp: "t2" });
    expect(received).toHaveLength(1);
    await client.close();
  });

  test("preloadScope() loads scope state", async () => {
    const { transport } = createMockTransport();
    const client = await createWeaverClient({ transport, scopeLoading: "lazy" });
    const scopeA = [{ scopeId: "tenant", value: "tenant-a" }];
    expect(client.get("feature.x", { scopePath: scopeA })).toBeUndefined();
    await client.preloadScope(scopeA);
    expect(client.get("feature.x", { scopePath: scopeA })).toBe(true);
    await client.close();
  });

  test("close() unsubscribes and closes transport", async () => {
    const { transport } = createMockTransport();
    const client = await createWeaverClient({ transport });
    await client.close();
    expect(client.connected).toBe(false);
  });

  test("namespace auto-prefix on get()", async () => {
    const { transport } = createMockTransport();
    const client = await createWeaverClient({ namespace: "db", transport });
    // "host" -> "db.host"
    expect(client.get("host")).toBe("localhost");
    // "/cache.ttl" -> absolute, strips leading /
    expect(client.get("/cache.ttl")).toBe(300);
    await client.close();
  });
});
