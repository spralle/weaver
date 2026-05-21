import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createWeaverClient } from "../src/client.js";
import { defineNamespace } from "../src/namespace.js";
import type { WeaverTransport } from "../src/transport.js";
import type { ConfigDelta, Unsubscribe } from "../src/types.js";

function createMockTransport(
  state: Record<string, unknown> = {},
): WeaverTransport & { fireDeltas: (deltas: ConfigDelta[]) => void } {
  const subscribers: Array<(delta: ConfigDelta) => void> = [];

  return {
    async resolveAll() {
      return { entries: { ...state }, scopes: {}, revision: "rev-1", timestamp: new Date().toISOString() };
    },
    async get(key) {
      return undefined;
    },
    async getNamespace(prefix) {
      return {};
    },
    async inspect(key) {
      return {};
    },
    subscribe(handler): Unsubscribe {
      subscribers.push(handler);
      return () => {
        const idx = subscribers.indexOf(handler);
        if (idx >= 0) subscribers.splice(idx, 1);
      };
    },
    async set(key, value) {
      return { success: true, revision: "rev-2" };
    },
    async setMany(entries) {
      return { success: true, revision: "rev-2" };
    },
    async remove(key) {
      return { success: true, revision: "rev-2" };
    },
    async listScopes() {
      return [];
    },
    async listScopeValues() {
      return [];
    },
    async close() {},
    fireDeltas(deltas: ConfigDelta[]) {
      for (const d of deltas) {
        for (const sub of subscribers) sub(d);
      }
    },
  };
}

describe("Integration: WeaverClient full flow", () => {
  it("creates client, uses typed namespace, get/set works", async () => {
    const transport = createMockTransport({ editor: { fontSize: 14, theme: "dark" } });
    const client = await createWeaverClient({ transport });

    const editorNs = defineNamespace("editor", {
      fontSize: z.number(),
      theme: z.string(),
    });

    const editor = client.namespace(editorNs);
    assert.equal(editor.get("fontSize"), 14);
    assert.equal(editor.get("theme"), "dark");

    const result = await editor.set("fontSize", 16);
    assert.equal(result.success, true);

    await client.close();
  });

  it("untyped namespace works with string prefix", async () => {
    const transport = createMockTransport({ editor: { fontSize: 14 } });
    const client = await createWeaverClient({ transport });

    const editor = client.namespace("editor");
    assert.equal(editor.get("fontSize"), 14);
    assert.deepEqual(editor.getAll(), { fontSize: 14 });

    await client.close();
  });

  it("registerNamespaces delegates to transport", async () => {
    const registered: string[] = [];
    const transport = createMockTransport();
    (transport as unknown as Record<string, unknown>).registerSchema = async (ns: string) => {
      registered.push(ns);
    };

    const client = await createWeaverClient({ transport });
    const defs = [defineNamespace("editor", { fontSize: z.number() })];
    const result = await client.registerNamespaces(defs);

    assert.deepEqual(result.registered, ["editor"]);
    assert.deepEqual(registered, ["editor"]);

    await client.close();
  });

  it("pendingRestart fires when restart-required key changes", async () => {
    const transport = createMockTransport({ app: { port: 3000 } });
    (transport as unknown as Record<string, unknown>).fetchSchemas = async () => ({
      "app.port": {
        type: "number",
        "x-weaver": { reloadBehavior: "restart-required" },
      },
    });

    const client = await createWeaverClient({ transport, schemas: true });
    assert.equal(client.pendingRestart, false);

    let restartFired = false;
    client.onRestartRequired(() => { restartFired = true; });

    transport.fireDeltas([{
      key: "app.port",
      action: "set",
      value: 4000,
      layer: "user",
      timestamp: new Date().toISOString(),
    }]);

    assert.equal(client.pendingRestart, true);
    assert.equal(restartFired, true);

    await client.close();
  });
});
