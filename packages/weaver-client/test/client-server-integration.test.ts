import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { WeaverClient } from "../src/client.js";
import { createWeaverClient } from "../src/client.js";
import type { LocalTransport } from "../src/local-transport.js";
import { createLocalTransport } from "../src/local-transport.js";
import type { ConfigDelta } from "../src/types.js";

describe("client↔server integration (local transport round-trip)", () => {
  let transport: LocalTransport;
  let client: WeaverClient;

  beforeEach(async () => {
    transport = createLocalTransport({
      snapshot: {
        entries: {
          app: { name: "initial" },
          database: { host: "localhost", port: 5432 },
        },
        scopes: {},
        revision: "rev-0",
        timestamp: new Date().toISOString(),
      },
    });

    client = await createWeaverClient({ transport });
  });

  afterEach(async () => {
    await client.close();
  });

  it("should set and get a value round-trip", async () => {
    const result = await client.set("app.name", "Weaver");
    assert.equal(result.success, true);

    const value = client.get<string>("app.name");
    assert.equal(value, "Weaver");
  });

  it("should get namespace values", () => {
    const ns = client.getNamespace("database");
    assert.deepEqual(ns, { host: "localhost", port: 5432 });
  });

  it("should reflect writes after delta notification", async () => {
    await client.set("cache.redis.host", "redis.local");

    // Simulate server pushing the delta back (as would happen in real server)
    transport.pushDelta({
      key: "cache.redis.host",
      action: "set",
      value: "redis.local",
      layer: "user",
      timestamp: new Date().toISOString(),
    });

    const value = client.get<string>("cache.redis.host");
    assert.equal(value, "redis.local");
  });

  it("should receive change deltas via subscription", () => {
    const received: ConfigDelta[] = [];
    client.onChange("app.*", (deltas) => {
      received.push(...deltas);
    });

    const delta: ConfigDelta = {
      key: "app.name",
      action: "set",
      value: "Updated",
      layer: "user",
      timestamp: new Date().toISOString(),
    };
    transport.pushDelta(delta);

    assert.equal(received.length, 1);
    assert.equal(received[0].key, "app.name");
    assert.equal(received[0].value, "Updated");
  });

  it("should remove a value", async () => {
    const result = await client.remove("app.name");
    assert.equal(result.success, true);

    const value = client.get("app.name");
    assert.equal(value, undefined);
  });

  it("should report connected mode after boot", () => {
    assert.equal(client.mode, "live");
    assert.equal(client.connected, true);
  });

  it("should transition to disconnected on close", async () => {
    await client.close();
    assert.equal(client.connected, false);
    // Re-assign so afterEach doesn't double-close
    client = await createWeaverClient({
      transport: createLocalTransport({
        snapshot: {
          entries: {},
          scopes: {},
          revision: "r",
          timestamp: new Date().toISOString(),
        },
      }),
    });
  });

  it("should set many values and confirm write success", async () => {
    const result = await client.setMany({
      "feature.a": true,
      "feature.b": false,
    });
    assert.equal(result.success, true);
    assert.ok(result.revision);
  });
});
