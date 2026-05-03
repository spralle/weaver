import { test, describe } from "bun:test";
import assert from "node:assert/strict";
import { createPromotionEngine } from "../../src/core/promotion-engine.ts";
import { createWeaverConfigService } from "../../src/core/config-service.ts";

function createTestProvider(id, layer, entries, writable = true) {
  let data = { ...entries };
  return {
    id,
    layer,
    writable,
    async load() { return { entries: { ...data } }; },
    async write(key, value) {
      if (!writable) return { success: false, error: "read-only" };
      data[key] = value;
      return { success: true };
    },
    async remove(key) {
      if (!writable) return { success: false, error: "read-only" };
      delete data[key];
      return { success: true };
    },
  };
}

describe("PromotionEngine", () => {
  test("promote copies value from source to target environment", async () => {
    const provider = createTestProvider("p1", "platform", { "db.host": "staging-db" });
    const configService = await createWeaverConfigService({
      providers: [provider],
      environment: "staging",
    });
    const engine = createPromotionEngine({ configService });

    const result = await engine.promote({
      key: "db.host",
      fromEnvironment: "staging",
      toEnvironment: "production",
      layer: "platform",
      actor: "admin",
    });

    assert.equal(result.success, true);
    assert.equal(result.method, "direct");
  });

  test("promote returns NOT_FOUND for missing key", async () => {
    const provider = createTestProvider("p1", "platform", {});
    const configService = await createWeaverConfigService({
      providers: [provider],
      environment: "staging",
    });
    const engine = createPromotionEngine({ configService });

    const result = await engine.promote({
      key: "nonexistent",
      fromEnvironment: "staging",
      toEnvironment: "production",
      layer: "platform",
      actor: "admin",
    });

    assert.equal(result.success, false);
    assert.equal(result.error?.code, "NOT_FOUND");
  });

  test("promote rejects non-promotable layers", async () => {
    const provider = createTestProvider("p1", "user", { "key": "val" });
    const configService = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });
    const engine = createPromotionEngine({ configService });

    const result = await engine.promote({
      key: "key",
      fromEnvironment: "dev",
      toEnvironment: "prod",
      layer: "user",
      actor: "admin",
    });

    assert.equal(result.success, false);
    assert.equal(result.error?.code, "POLICY_VIOLATION");
  });

  test("direct promotion method writes value", async () => {
    const provider = createTestProvider("p1", "platform", { "feature.flag": true });
    const configService = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });
    const engine = createPromotionEngine({ configService });

    const result = await engine.promote({
      key: "feature.flag",
      fromEnvironment: "dev",
      toEnvironment: "prod",
      layer: "platform",
      actor: "admin",
    });

    assert.equal(result.success, true);
    assert.equal(result.method, "direct");
    const val = await configService.get("feature.flag");
    assert.equal(val, true);
  });
});
