import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWeaverClient } from "../src/client.js";
import type { WeaverClientPersistence } from "../src/persistence.js";
import type { WeaverTransport } from "../src/transport.js";
import type { ConfigDelta, ConfigSnapshot } from "../src/types.js";

function makeSnapshot(
  entries: Record<string, unknown> = {},
  revision = "rev-cached",
): ConfigSnapshot {
  return { entries, scopes: {}, revision, timestamp: new Date().toISOString() };
}

function createFailingTransport(): WeaverTransport {
  return {
    async resolveAll() {
      throw new Error("Network unavailable");
    },
    subscribe(_cb: (delta: ConfigDelta) => void) {
      return () => {};
    },
    async inspect(_key: string) {
      throw new Error("offline");
    },
    async get(_key: string) {
      return undefined;
    },
    async getNamespace(_prefix: string) {
      return {};
    },
    async set(_key: string, _value: unknown) {
      return { success: false, revision: "" };
    },
    async setMany(_entries: Record<string, unknown>) {
      return { success: false, revision: "" };
    },
    async remove(_key: string) {
      return { success: false, revision: "" };
    },
    async listScopes() {
      return [];
    },
    async listScopeValues() {
      return [];
    },
    async close() {},
  };
}

function createMemoryPersistence(
  initial?: ConfigSnapshot,
): WeaverClientPersistence {
  let stored: ConfigSnapshot | null = initial ?? null;
  return {
    async save(_ns: string, snapshot: ConfigSnapshot) {
      stored = snapshot;
    },
    async load(_ns: string) {
      return stored;
    },
  };
}

describe("Offline Boot", () => {
  it("boots from cache when transport throws", async () => {
    const cached = makeSnapshot({ app: { name: "cached" } }, "rev-1");
    const persistence = createMemoryPersistence(cached);
    const transport = createFailingTransport();

    const client = await createWeaverClient({
      transport,
      persistence,
      offlineBoot: true,
    });

    assert.equal(client.get<string>("app.name"), "cached");
    assert.equal(client.connected, false);
    assert.equal(client.revision, "rev-1");
  });

  it("throws if transport fails AND no cache exists", async () => {
    const persistence = createMemoryPersistence();
    const transport = createFailingTransport();

    await assert.rejects(
      () => createWeaverClient({ transport, persistence, offlineBoot: true }),
      /Network unavailable/,
    );
  });

  it("throws if offlineBoot is disabled even with cache", async () => {
    const cached = makeSnapshot({ app: { name: "cached" } }, "rev-1");
    const persistence = createMemoryPersistence(cached);
    const transport = createFailingTransport();

    await assert.rejects(
      () =>
        createWeaverClient({
          transport,
          persistence,
          offlineBoot: false,
        }),
      /Network unavailable/,
    );
  });

  it("staleSince is set from monitor (null initially when fresh)", async () => {
    const cached = makeSnapshot({ x: 1 }, "rev-1");
    const persistence = createMemoryPersistence(cached);
    const transport = createFailingTransport();

    const client = await createWeaverClient({
      transport,
      persistence,
      offlineBoot: true,
    });

    // staleSince comes from the monitor — initially null since maxAge hasn't elapsed
    assert.equal(client.staleSince, null);
  });
});
