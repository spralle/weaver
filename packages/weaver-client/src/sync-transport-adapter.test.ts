import type { SyncMutationMetadata } from "@weaver-conf/config-types";
import { createLocalTransport } from "./local-transport";
import { createWeaverSyncTransport } from "./sync-transport-adapter";
import type { ConfigSnapshot } from "./types";

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
      expect(result.changes.length).toBe(1);
      expect(result.changes.every((c) => c.operation === "set")).toBeTruthy();
      const keys = result.changes.map((c) => c.key).sort();
      expect(keys).toEqual(["app"]);
    });

    it("returns only changed entries on subsequent call", async () => {
      const { syncTransport, snapshot } = setup();
      await syncTransport.pull({});

      (snapshot.entries as Record<string, unknown>).app = {
        name: "updated",
        port: 3000,
      };
      const result = await syncTransport.pull({});
      expect(result.changes.length).toBe(1);
      const change = result.changes[0];
      expect(change).toBeTruthy();
      if (!change) {
        throw new Error("Expected change entry");
      }
      expect(change.key).toBe("app");
    });

    it("detects removed keys", async () => {
      const { syncTransport, snapshot } = setup();
      await syncTransport.pull({});

      delete (snapshot.entries as Record<string, unknown>).app;
      const result = await syncTransport.pull({});
      expect(result.changes.length).toBe(1);
      const change = result.changes[0];
      expect(change).toBeTruthy();
      if (!change) {
        throw new Error("Expected change entry");
      }
      expect(change.key).toBe("app");
      expect(change.operation).toBe("remove");
    });

    it("respects limit parameter", async () => {
      const { syncTransport } = setup({ a: 1, b: 2, c: 3 });
      const result = await syncTransport.pull({ limit: 2 });
      expect(result.changes.length).toBe(2);
    });

    it("returns correct cursor with revision and serverTime", async () => {
      const { syncTransport } = setup();
      const result = await syncTransport.pull({});
      expect(result.cursor.serverRevision).toBe("rev-1");
      expect(typeof result.cursor.serverTime).toBe("number");
      expect(typeof result.serverTime).toBe("number");
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
      expect(
        (snapshot.entries as Record<string, Record<string, unknown>>).new?.key,
      ).toBe("hello");
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
      expect(
        (snapshot.entries as Record<string, Record<string, unknown>>).del?.key,
      ).toBe(undefined);
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
      const r = result.results[0];
      expect(r).toBeTruthy();
      if (!r) {
        throw new Error("Expected push result");
      }
      expect(r.accepted).toBe(true);
      expect(r.mutationId).toBe("m-3");
      expect(r.revision).toBeTruthy();
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
      expect(result.requestId).toBe("req-4");
      expect(result.serverRevision).toBeTruthy();
      expect(typeof result.serverTime).toBe("number");
    });
  });

  describe("ack", () => {
    it("returns acked=true as no-op", async () => {
      const { syncTransport } = setup();
      const result = await syncTransport.ack({ requestId: "req-5" });
      expect(result.requestId).toBe("req-5");
      expect(result.acked).toBe(true);
      expect(typeof result.serverTime).toBe("number");
    });
  });
});
