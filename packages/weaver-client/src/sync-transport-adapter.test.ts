import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SyncMutationMetadata } from "@weaver/config-types";
import { createLocalTransport } from "./local-transport.js";
import { createWeaverSyncTransport } from "./sync-transport-adapter.js";
import type { ConfigSnapshot } from "./types.js";

const testMeta: SyncMutationMetadata = {
  queuedAt: Date.now(),
  attemptCount: 0,
  policyAllowed: true,
};

function makeSnapshot(entries: Record<string, unknown>): ConfigSnapshot {
  return { entries, scopes: {}, revision: "rev-1" };
}

function setup(entries?: Record<string, unknown>) {
  const snapshot = makeSnapshot(
    entries ?? { app: { name: "test", port: 3000 } },
  );
  const transport = createLocalTransport({ snapshot });
  const syncTransport = createWeaverSyncTransport(transport);
  return { transport, syncTransport, snapshot };
}

describe("createWeaverSyncTransport", () => {
  describe("pull", () => {
    it("returns all entries as set changes on first call", async () => {
      const { syncTransport } = setup();
      const result = await syncTransport.pull({});
      assert.equal(result.changes.length, 1);
      assert.ok(result.changes.every((c) => c.operation === "set"));
      const keys = result.changes.map((c) => c.key).sort();
      assert.deepEqual(keys, ["app"]);
    });

    it("returns only changed entries on subsequent call", async () => {
      const { syncTransport, snapshot } = setup();
      await syncTransport.pull({});

      (snapshot.entries as Record<string, unknown>).app = {
        name: "updated",
        port: 3000,
      };
      const result = await syncTransport.pull({});
      assert.equal(result.changes.length, 1);
      const change = result.changes[0]!;
      assert.equal(change.key, "app");
    });

    it("detects removed keys", async () => {
      const { syncTransport, snapshot } = setup();
      await syncTransport.pull({});

      delete (snapshot.entries as Record<string, unknown>).app;
      const result = await syncTransport.pull({});
      assert.equal(result.changes.length, 1);
      const change = result.changes[0]!;
      assert.equal(change.key, "app");
      assert.equal(change.operation, "remove");
    });

    it("respects limit parameter", async () => {
      const { syncTransport } = setup({ a: 1, b: 2, c: 3 });
      const result = await syncTransport.pull({ limit: 2 });
      assert.equal(result.changes.length, 2);
    });

    it("returns correct cursor with revision and serverTime", async () => {
      const { syncTransport } = setup();
      const result = await syncTransport.pull({});
      assert.equal(result.cursor.serverRevision, "rev-1");
      assert.equal(typeof result.cursor.serverTime, "number");
      assert.equal(typeof result.serverTime, "number");
    });
  });

  describe("push", () => {
    it("delegates set mutation to transport.set()", async () => {
      const { syncTransport, snapshot } = setup({});
      await syncTransport.push({
        requestId: "req-1",
        mutations: [
          {
            mutationId: "m-1",
            key: "new.key",
            operation: "set",
            value: "hello",
            metadata: testMeta,
          },
        ],
      });
      assert.equal(
        (snapshot.entries as Record<string, Record<string, unknown>>).new?.key,
        "hello",
      );
    });

    it("delegates remove mutation to transport.remove()", async () => {
      const { syncTransport, snapshot } = setup({ del: { key: "bye" } });
      await syncTransport.push({
        requestId: "req-2",
        mutations: [
          {
            mutationId: "m-2",
            key: "del.key",
            operation: "remove",
            metadata: testMeta,
          },
        ],
      });
      assert.equal(
        (snapshot.entries as Record<string, Record<string, unknown>>).del?.key,
        undefined,
      );
    });

    it("returns accepted=true on success", async () => {
      const { syncTransport } = setup();
      const result = await syncTransport.push({
        requestId: "req-3",
        mutations: [
          {
            mutationId: "m-3",
            key: "app.name",
            operation: "set",
            value: "new",
            metadata: testMeta,
          },
        ],
      });
      const r = result.results[0]!;
      assert.equal(r.accepted, true);
      assert.equal(r.mutationId, "m-3");
      assert.ok(r.revision);
    });

    it("returns requestId and serverRevision", async () => {
      const { syncTransport } = setup();
      const result = await syncTransport.push({
        requestId: "req-4",
        mutations: [
          {
            mutationId: "m-4",
            key: "x",
            operation: "set",
            value: 1,
            metadata: testMeta,
          },
        ],
      });
      assert.equal(result.requestId, "req-4");
      assert.ok(result.serverRevision);
      assert.equal(typeof result.serverTime, "number");
    });
  });

  describe("ack", () => {
    it("returns acked=true as no-op", async () => {
      const { syncTransport } = setup();
      const result = await syncTransport.ack({ requestId: "req-5" });
      assert.equal(result.requestId, "req-5");
      assert.equal(result.acked, true);
      assert.equal(typeof result.serverTime, "number");
    });
  });
});
