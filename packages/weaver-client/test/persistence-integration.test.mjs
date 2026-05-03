import { test, expect, describe } from "bun:test";
import { createWeaverClient } from "../src/client.js";

function createDelayedTransport(snapshot, delayMs) {
  const subscribers = new Set();
  return {
    async resolveAll() {
      await new Promise((r) => setTimeout(r, delayMs));
      return snapshot;
    },
    async get() { return undefined; },
    async getNamespace() { return {}; },
    subscribe(_sid, handler) {
      subscribers.add(handler);
      return () => subscribers.delete(handler);
    },
    async close() {},
  };
}

const snapshot = {
  platform: { "key": "fresh" },
  tenants: {},
  revision: "rev-2",
  timestamp: "2026-01-01T00:00:00Z",
};

const cachedSnapshot = {
  platform: { "key": "cached" },
  tenants: {},
  revision: "rev-1",
  timestamp: "2025-12-01T00:00:00Z",
};

describe("Persistence integration", () => {
  test("client uses fresh snapshot after transport resolves", async () => {
    let saved = null;
    const persistence = {
      async load() { return cachedSnapshot; },
      async save(_sid, snap) { saved = snap; },
    };
    const transport = createDelayedTransport(snapshot, 10);
    const client = await createWeaverClient({ serviceId: "svc", transport, persistence });
    // After creation, fresh snapshot is used
    expect(client.get("key")).toBe("fresh");
    expect(client.revision).toBe("rev-2");
    expect(saved).toEqual(snapshot);
    await client.close();
  });

  test("client overwrites cache when fresh snapshot arrives", async () => {
    let saved = null;
    const persistence = {
      async load() { return cachedSnapshot; },
      async save(_sid, snap) { saved = snap; },
    };
    const transport = createDelayedTransport(snapshot, 0);
    const client = await createWeaverClient({ serviceId: "svc", transport, persistence });
    expect(saved).toEqual(snapshot);
    await client.close();
  });
});
