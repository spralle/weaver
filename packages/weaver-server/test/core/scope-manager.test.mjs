import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createScopeManager } from "../../src/core/scope-manager.ts";
import { createSchemaRegistry } from "../../src/core/schema-registry.ts";
import { createWeaverConfigService } from "../../src/core/config-service.ts";

function createTestProvider(id, layer, entries, writable = true) {
  let data = { ...entries };
  return {
    id,
    layer,
    writable,
    async load() { return { entries: { ...data } }; },
    async write(key, value) { data[key] = value; return { success: true }; },
    async remove(key) { delete data[key]; return { success: true }; },
  };
}

describe("ScopeManager", () => {
  test("provision creates new scope", async () => {
    const platformProvider = createTestProvider("p1", "platform", {});
    const configService = await createWeaverConfigService({
      providers: [platformProvider],
      environment: "dev",
    });
    const schemaRegistry = createSchemaRegistry({ configService });
    const sm = createScopeManager({ configService, schemaRegistry });

    const result = await sm.provision({ scopeId: "tenant", value: "acme", actor: "admin" });
    assert.equal(result.scopeId, "tenant");
    assert.equal(result.value, "acme");
    assert.ok(sm.listScopeValues("tenant").includes("acme"));
  });

  test("deprovision removes scope", async () => {
    const tenantProvider = createTestProvider("t-old", "tenant:old-co", { "_weaver.scope.tenant": "old-co" });
    const configService = await createWeaverConfigService({
      providers: [createTestProvider("p1", "platform", {}), tenantProvider],
      environment: "dev",
    });
    const schemaRegistry = createSchemaRegistry({ configService });
    const sm = createScopeManager({ configService, schemaRegistry });

    const result = await sm.deprovision({ scopeId: "tenant", value: "old-co", actor: "admin" });
    assert.equal(result.success, true);
    assert.ok(!sm.listScopeValues("tenant").includes("old-co"));
  });

  test("listScopeValues returns active scope values", async () => {
    const t1 = createTestProvider("t1", "tenant:alpha", {});
    const t2 = createTestProvider("t2", "tenant:beta", {});
    const configService = await createWeaverConfigService({
      providers: [createTestProvider("p1", "platform", {}), t1, t2],
      environment: "dev",
    });
    const schemaRegistry = createSchemaRegistry({ configService });
    const sm = createScopeManager({ configService, schemaRegistry });

    const values = sm.listScopeValues("tenant");
    assert.ok(values.includes("alpha"));
    assert.ok(values.includes("beta"));
  });

  test("listScopes returns distinct scope definitions", async () => {
    const t1 = createTestProvider("t1", "tenant:alpha", {});
    const s1 = createTestProvider("s1", "site:oslo", {});
    const configService = await createWeaverConfigService({
      providers: [createTestProvider("p1", "platform", {}), t1, s1],
      environment: "dev",
    });
    const schemaRegistry = createSchemaRegistry({ configService });
    const sm = createScopeManager({ configService, schemaRegistry });

    const scopes = sm.listScopes();
    assert.ok(scopes.some(s => s.id === "tenant"));
    assert.ok(scopes.some(s => s.id === "site"));
  });

  test("duplicate provision returns error", async () => {
    const tenantProvider = createTestProvider("t-dup", "tenant:dup", {});
    const configService = await createWeaverConfigService({
      providers: [createTestProvider("p1", "platform", {}), tenantProvider],
      environment: "dev",
    });
    const schemaRegistry = createSchemaRegistry({ configService });
    const sm = createScopeManager({ configService, schemaRegistry });

    const result = await sm.provision({ scopeId: "tenant", value: "dup", actor: "admin" });
    assert.equal(result.success, false);
    assert.equal(result.error?.code, "VALIDATION_ERROR");
  });
});
