import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createWeaverConfigService } from "../../src/core/config-service.ts";

function createTestProvider(id, layer, entries, writable = true) {
  let data = { ...entries };
  return {
    id,
    layer,
    writable,
    async load() { return { entries: { ...data } }; },
    async write(key, value) {
      if (!writable) return { success: false, error: { code: "READONLY", message: "read-only" } };
      data[key] = value;
      return { success: true };
    },
    async remove(key) {
      if (!writable) return { success: false, error: { code: "READONLY", message: "read-only" } };
      delete data[key];
      return { success: true };
    },
  };
}

describe("WeaverConfigService write path", () => {
  test("set writes value and updates merged state", async () => {
    const provider = createTestProvider("p1", "platform", { "key": "old" });
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const result = await svc.set("platform", "key", "new");
    assert.equal(result.success, true);
    assert.equal(await svc.get("key"), "new");
  });

  test("remove removes key and updates merged state", async () => {
    const provider = createTestProvider("p1", "platform", { "key": "val" });
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const result = await svc.remove("platform", "key");
    assert.equal(result.success, true);
    assert.equal(await svc.get("key"), undefined);
  });

  test("set on read-only provider returns error", async () => {
    const provider = createTestProvider("p1", "platform", {}, false);
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const result = await svc.set("platform", "key", "val");
    assert.equal(result.success, false);
    assert.equal(result.error?.code, "READONLY");
    assert.ok(result.error?.message.includes("read-only"));
  });

  test("onDelta fires after successful write", async () => {
    const provider = createTestProvider("p1", "platform", {});
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const deltas = [];
    svc.onDelta((d) => deltas.push(d));

    await svc.set("platform", "foo", "bar");
    assert.equal(deltas.length, 1);
    assert.equal(deltas[0].action, "set");
    assert.equal(deltas[0].key, "foo");
    assert.equal(deltas[0].value, "bar");
    assert.equal(deltas[0].layer, "platform");
  });

  test("delta has correct action for remove", async () => {
    const provider = createTestProvider("p1", "platform", { "x": 1 });
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const deltas = [];
    svc.onDelta((d) => deltas.push(d));

    await svc.remove("platform", "x");
    assert.equal(deltas[0].action, "remove");
    assert.equal(deltas[0].key, "x");
    assert.equal(deltas[0].value, null);
  });

  test("size warning for large values", async () => {
    const provider = createTestProvider("p1", "platform", {});
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const warnings = [];
    const origWarn = console.warn;
    console.warn = (msg) => warnings.push(msg);

    const bigValue = "x".repeat(1_048_577);
    await svc.set("platform", "big", bigValue);

    console.warn = origWarn;
    assert.ok(warnings.some((w) => w.includes("exceeds 1MB")));
  });
});
