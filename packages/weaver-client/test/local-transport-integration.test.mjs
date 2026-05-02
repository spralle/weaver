import { test, expect, describe } from "bun:test";
import { createWeaverClient } from "../src/client.js";
import { createLocalTransport } from "../src/local-transport.js";

const snapshot = {
  platform: { "db.host": "localhost", "db.port": 5432 },
  tenants: { "t1": { "feature.x": true } },
  revision: "rev-1",
  timestamp: "2026-01-01T00:00:00Z",
};

describe("LocalTransport integration", () => {
  test("full client with LocalTransport: get works", async () => {
    const transport = createLocalTransport({ snapshot });
    const client = await createWeaverClient({ serviceId: "svc", transport, tenantMode: "eager" });
    expect(client.get("db.host")).toBe("localhost");
    expect(client.get("feature.x", { tenantId: "t1" })).toBe(true);
    await client.close();
  });

  test("getNamespace works through full client", async () => {
    const transport = createLocalTransport({ snapshot });
    const client = await createWeaverClient({ serviceId: "svc", transport });
    expect(client.getNamespace("db.")).toEqual({ "db.host": "localhost", "db.port": 5432 });
    await client.close();
  });

  test("pushDelta updates client state via onChange", async () => {
    const transport = createLocalTransport({ snapshot });
    const client = await createWeaverClient({ serviceId: "svc", transport });
    const received = [];
    client.onChange("db.*", (changes) => received.push(...changes));
    transport.pushDelta({ action: "set", key: "db.host", value: "newhost", layer: "platform", environment: "prod", timestamp: "t1" });
    expect(received).toHaveLength(1);
    expect(client.get("db.host")).toBe("newhost");
    await client.close();
  });
});
