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
    subscribe(handler) {
      subscribers.add(handler);
      return () => subscribers.delete(handler);
    },
    async close() {},
  };
}

const snapshot = {
  entries: { "key": "fresh" },
  scopes: {},
  revision: "rev-2",
  timestamp: "2026-01-01T00:00:00Z",
};

const cachedSnapshot = {
  entries: { "key": "cached" },
  scopes: {},
  revision: "rev-1",
  timestamp: "2025-12-01T00:00:00Z",
};

describe("Persistence integration", () => {
  test("client uses fresh snapshot after transport resolves", async () => {
    let saved = null;
    const persistence = {
      async load() { return cachedSnapshot; },
      async save(_ns, snap) { saved = snap; },
    };
    const transport = createDelayedTransport(snapshot, 10);
    const client = await createWeaverClient({ transport, persistence });
    expect(client.get("key")).toBe("fresh");
    expect(client.revision).toBe("rev-2");
    expect(saved).toEqual(snapshot);
    await client.close();
  });

  test("client overwrites cache when fresh snapshot arrives", async () => {
    let saved = null;
    const persistence = {
      async load() { return cachedSnapshot; },
      async save(_ns, snap) { saved = snap; },
    };
    const transport = createDelayedTransport(snapshot, 0);
    const client = await createWeaverClient({ transport, persistence });
    expect(saved).toEqual(snapshot);
    await client.close();
  });
});
