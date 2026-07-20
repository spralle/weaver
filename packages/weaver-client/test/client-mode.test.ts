import { createWeaverClient } from "../src/client.js";
import type { WeaverClientPersistence } from "../src/persistence.js";
import type { WeaverTransport } from "../src/transport.js";
import type { ConfigDelta, ConfigSnapshot } from "../src/types.js";

function makeSnapshot(
  entries: Record<string, unknown> = {},
  revision = "rev-1",
): ConfigSnapshot {
  return { entries, scopes: {}, revision, timestamp: new Date().toISOString() };
}

function createSuccessTransport(snapshot?: ConfigSnapshot): WeaverTransport {
  const snap = snapshot ?? makeSnapshot({ app: { name: "live" } });
  return {
    async resolveAll() {
      return snap;
    },
    subscribe(_cb: (delta: ConfigDelta) => void) {
      return () => {};
    },
    async inspect(_key: string) {
      return { key: _key, layerValues: {} };
    },
    async get(_key: string) {
      return undefined;
    },
    async getNamespace(_prefix: string) {
      return {};
    },
    async set(_key: string, _value: unknown) {
      return { success: true, revision: "rev-2" };
    },
    async setMany(_entries: Record<string, unknown>) {
      return { success: true, revision: "rev-2" };
    },
    async remove(_key: string) {
      return { success: true, revision: "rev-2" };
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

describe("ClientMode", () => {
  it("mode is 'live' when transport connects successfully", async () => {
    const client = await createWeaverClient({
      transport: createSuccessTransport(),
    });

    expect(client.mode).toBe("live");
    expect(client.connected).toBe(true);
  });

  it("mode is 'cached' when transport fails but cache exists", async () => {
    const cached = makeSnapshot({ app: { name: "cached" } }, "rev-cached");
    const persistence = createMemoryPersistence(cached);

    const client = await createWeaverClient({
      transport: createFailingTransport(),
      persistence,
      offlineBoot: true,
    });

    expect(client.mode).toBe("cached");
    expect(client.connected).toBe(false);
    expect(client.revision).not.toBe("");
  });

  it("mode transitions from 'live' to 'cached' after close", async () => {
    const persistence = createMemoryPersistence();
    const client = await createWeaverClient({
      transport: createSuccessTransport(),
      persistence,
    });

    expect(client.mode).toBe("live");

    await client.close();

    // After close, connected=false but revision still set → cached
    expect(client.mode).toBe("cached");
  });
});
