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
    expect(result.scopeId).toBe("tenant");
    expect(result.value).toBe("acme");
    expect(sm.listScopeValues("tenant").includes("acme")).toBeTruthy();
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
    expect(result.success).toBe(true);
    expect(!sm.listScopeValues("tenant").includes("old-co")).toBeTruthy();
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
    expect(values.includes("alpha")).toBeTruthy();
    expect(values.includes("beta")).toBeTruthy();
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
    expect(scopes.some(s => s.id === "tenant")).toBeTruthy();
    expect(scopes.some(s => s.id === "site")).toBeTruthy();
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
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
  });
});
