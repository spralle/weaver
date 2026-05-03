import { test, describe } from "bun:test";
import assert from "node:assert/strict";
import { createWeaverConfigService } from "../../src/core/config-service.ts";
import { createSSEAdapter } from "../../src/transport/sse-adapter.ts";

function createTestProvider(id, layer, entries, writable = true) {
  let data = { ...entries };
  return {
    id,
    layer,
    writable,
    async load() { return { entries: { ...data } }; },
    async write(key, value) {
      data[key] = value;
      return { success: true };
    },
    async remove(key) {
      delete data[key];
      return { success: true };
    },
  };
}

async function setup() {
  const provider = createTestProvider("p1", "platform", { "app.name": "test" });
  const svc = await createWeaverConfigService({ providers: [provider], environment: "dev" });
  const adapter = createSSEAdapter({ configService: svc });
  return { svc, adapter };
}

describe("SSEAdapter", () => {
  test("createClient creates SSE client", async () => {
    const { adapter } = await setup();
    const client = await adapter.createClient();
    assert.ok(client.id);
    assert.equal(adapter.clientCount, 1);
    client.close();
  });

  test("client receives deltas", async () => {
    const { svc, adapter } = await setup();
    const client = await adapter.createClient();
    await svc.set("platform", "app.name", "updated");
    assert.equal(adapter.clientCount, 1);
    client.close();
  });

  test("key pattern filtering", async () => {
    const { svc, adapter } = await setup();
    const client = await adapter.createClient({ prefix: "db" });
    await svc.set("platform", "db.host", "newhost");
    await svc.set("platform", "app.name", "ignored");
    assert.equal(adapter.clientCount, 1);
    client.close();
  });

  test("removeClient stops delta delivery", async () => {
    const { adapter } = await setup();
    const client = await adapter.createClient();
    assert.equal(adapter.clientCount, 1);
    adapter.removeClient(client);
    assert.equal(adapter.clientCount, 0);
  });

  test("closeAll removes all clients", async () => {
    const { adapter } = await setup();
    await adapter.createClient();
    await adapter.createClient();
    assert.equal(adapter.clientCount, 2);
    adapter.closeAll();
    assert.equal(adapter.clientCount, 0);
  });

  test("clientCount tracks active connections", async () => {
    const { adapter } = await setup();
    assert.equal(adapter.clientCount, 0);
    const c1 = await adapter.createClient();
    assert.equal(adapter.clientCount, 1);
    const c2 = await adapter.createClient();
    assert.equal(adapter.clientCount, 2);
    c1.close();
    assert.equal(adapter.clientCount, 1);
    c2.close();
    assert.equal(adapter.clientCount, 0);
  });
});
