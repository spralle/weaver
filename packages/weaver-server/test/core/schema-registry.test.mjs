import { test, describe } from "bun:test";
import assert from "node:assert/strict";
import { createSchemaRegistry } from "../../src/core/schema-registry.ts";
import { createWeaverConfigService } from "../../src/core/config-service.ts";

function createTestProvider(id, layer, entries) {
  let data = { ...entries };
  return {
    id,
    layer,
    writable: true,
    async load() { return { entries: { ...data } }; },
    async write(key, value) { data[key] = value; return { success: true }; },
    async remove(key) { delete data[key]; return { success: true }; },
  };
}

function makeOptions() {
  const provider = createTestProvider("p1", "platform", {});
  return createWeaverConfigService({
    providers: [provider],
    environment: "dev",
  }).then((configService) => ({
    configService,
  }));
}

describe("SchemaRegistry", () => {
  test("register new schema succeeds with isNewSchema true", async () => {
    const opts = await makeOptions();
    const registry = createSchemaRegistry(opts);

    const result = await registry.register({
      serviceId: "my-service",
      declaration: { properties: { port: { type: "number", default: 3000 } } },
      environment: "dev",
    });

    assert.equal(result.success, true);
    assert.equal(result.isNewSchema, true);
    assert.equal(result.hasBreakingChanges, false);
  });

  test("register unchanged schema is idempotent", async () => {
    const opts = await makeOptions();
    const registry = createSchemaRegistry(opts);
    const declaration = { properties: { port: { type: "number" } } };

    await registry.register({ serviceId: "svc", declaration, environment: "dev" });
    const result = await registry.register({ serviceId: "svc", declaration, environment: "dev" });

    assert.equal(result.success, true);
    assert.equal(result.isNewSchema, false);
    assert.equal(result.hasBreakingChanges, false);
  });

  test("register with removed property detects breaking change", async () => {
    const opts = await makeOptions();
    const registry = createSchemaRegistry(opts);

    await registry.register({
      serviceId: "svc",
      declaration: { properties: { port: { type: "number" }, host: { type: "string" } } },
      environment: "dev",
    });

    const result = await registry.register({
      serviceId: "svc",
      declaration: { properties: { port: { type: "number" } } },
      environment: "dev",
    });

    assert.equal(result.success, true);
    assert.equal(result.hasBreakingChanges, true);
    assert.ok(result.breakingChanges?.some((c) => c.includes("host")));
  });

  test("getSchema returns registered schema", async () => {
    const opts = await makeOptions();
    const registry = createSchemaRegistry(opts);
    const declaration = { properties: { key: { type: "string" } } };

    await registry.register({ serviceId: "svc", declaration, environment: "dev" });
    const schema = await registry.getSchema("svc", "dev");

    assert.deepEqual(schema, declaration);
  });

  test("getSchema returns null for unknown service", async () => {
    const opts = await makeOptions();
    const registry = createSchemaRegistry(opts);

    const schema = await registry.getSchema("unknown", "dev");
    assert.equal(schema, null);
  });
});
