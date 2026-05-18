import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createWeaverConfigService } from "../../src/core/config-service.ts";
import { createScompAdapter } from "../../src/transport/scomp-adapter.ts";
import { deepSet, deepRemove } from "@weaver/config-engine";

function createTestProvider(id, layer, entries, writable = true) {
  let data = JSON.parse(JSON.stringify(entries));
  return {
    id,
    layer,
    writable,
    async load() { return { entries: JSON.parse(JSON.stringify(data)) }; },
    async write(key, value) {
      deepSet(data, key, value);
      return { success: true };
    },
    async remove(key) {
      deepRemove(data, key);
      return { success: true };
    },
  };
}

async function setup() {
  const provider = createTestProvider("p1", "platform", { app: { name: "test", port: 3000 } });
  const svc = await createWeaverConfigService({ providers: [provider], environment: "dev" });
  const adapter = createScompAdapter({ configService: svc });
  return { svc, adapter };
}

describe("ScompAdapter", () => {
  test("handleRequest resolveAll returns ConfigSnapshot", async () => {
    const { adapter } = await setup();
    const result = await adapter.handleRequest("resolveAll", {});
    assert.ok(result.entries);
    assert.equal(result.entries.app.name, "test");
    assert.ok(result.revision);
  });

  test("handleRequest get returns value", async () => {
    const { adapter } = await setup();
    const result = await adapter.handleRequest("get", { key: "app.name" });
    assert.deepEqual(result, { value: "test" });
  });

  test("handleRequest set writes and returns result", async () => {
    const { adapter } = await setup();
    const result = await adapter.handleRequest("set", { layer: "platform", key: "app.new", value: "hello" });
    assert.equal(result.success, true);
    const get = await adapter.handleRequest("get", { key: "app.new" });
    assert.deepEqual(get, { value: "hello" });
  });

  test("handleRequest remove returns result", async () => {
    const { adapter } = await setup();
    const result = await adapter.handleRequest("remove", { layer: "platform", key: "app.name" });
    assert.equal(result.success, true);
    const get = await adapter.handleRequest("get", { key: "app.name" });
    assert.deepEqual(get, { value: undefined });
  });

  test("addSubscriber receives deltas", async () => {
    const { adapter, svc } = await setup();
    const received = [];
    adapter.addSubscriber((delta) => received.push(delta));
    await svc.set("platform", "x", 1);
    assert.equal(received.length, 1);
    assert.equal(received[0].key, "x");
  });

  test("unknown operation returns error", async () => {
    const { adapter } = await setup();
    const result = await adapter.handleRequest("bogus", {});
    assert.equal(result.code, "VALIDATION_ERROR");
    assert.ok(result.message.includes("Unknown operation"));
  });

  test("error wrapping on service error", async () => {
    const provider = createTestProvider("p1", "platform", {});
    provider.write = async () => { throw new Error("disk full"); };
    const svc = await createWeaverConfigService({ providers: [provider], environment: "dev" });
    const adapter = createScompAdapter({ configService: svc });
    const result = await adapter.handleRequest("set", { layer: "platform", key: "k", value: "v" });
    assert.equal(result.code, "VALIDATION_ERROR");
    assert.ok(result.message.includes("disk full"));
  });
});
