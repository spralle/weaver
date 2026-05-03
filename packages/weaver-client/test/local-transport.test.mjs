import { test, expect, describe } from "bun:test";
import { createLocalTransport } from "../src/local-transport.js";

const snapshot = {
  platform: { "db.host": "localhost", "db.port": 5432, "cache.ttl": 300 },
  tenants: { "t1": { "feature.x": true } },
  revision: "rev-1",
  timestamp: "2026-01-01T00:00:00Z",
};

describe("LocalTransport", () => {
  test("resolveAll returns provided snapshot", async () => {
    const t = createLocalTransport({ snapshot });
    const result = await t.resolveAll("svc");
    expect(result).toEqual(snapshot);
  });

  test("get returns correct value", async () => {
    const t = createLocalTransport({ snapshot });
    expect(await t.get("svc", "db.host")).toBe("localhost");
    expect(await t.get("svc", "feature.x", { tenantId: "t1" })).toBe(true);
  });

  test("getNamespace returns filtered keys", async () => {
    const t = createLocalTransport({ snapshot });
    const ns = await t.getNamespace("svc", "db.");
    expect(ns).toEqual({ "db.host": "localhost", "db.port": 5432 });
  });

  test("subscribe + pushDelta fires handler", () => {
    const t = createLocalTransport({ snapshot });
    const received = [];
    t.subscribe("svc", (delta) => received.push(delta));
    const delta = { action: "set", key: "db.host", value: "newhost", layer: "platform", environment: "prod", timestamp: "t1" };
    t.pushDelta(delta);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(delta);
  });

  test("close is safe to call multiple times", async () => {
    const t = createLocalTransport({ snapshot });
    await t.close();
    await t.close();
  });
});
