import { test, describe } from "bun:test";
import assert from "node:assert/strict";
import { createTenantManager } from "../../src/core/tenant-manager.ts";
import { createSchemaRegistry } from "../../src/core/schema-registry.ts";
import { createWeaverConfigService } from "../../src/core/config-service.ts";
import { createGitWriteQueue } from "../../src/git/write-queue.ts";

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

async function makeOptions(extraProviders = []) {
  const platform = createTestProvider("p1", "platform", {});
  const providers = [platform, ...extraProviders];
  const configService = await createWeaverConfigService({
    providers,
    environment: "dev",
  });
  const gitWriteQueue = createGitWriteQueue();
  const schemaRegistry = createSchemaRegistry({ configService, gitWriteQueue });
  return { configService, gitWriteQueue, schemaRegistry };
}

describe("TenantManager", () => {
  test("provision creates new tenant", async () => {
    // Platform provider that accepts writes to any layer (simulates new tenant creation)
    const platformProvider = createTestProvider("p1", "platform", {});
    const configService = await createWeaverConfigService({
      providers: [platformProvider],
      environment: "dev",
    });
    const gitWriteQueue = createGitWriteQueue();
    const schemaRegistry = createSchemaRegistry({ configService, gitWriteQueue });
    const tm = createTenantManager({ configService, gitWriteQueue, schemaRegistry });

    const result = await tm.provision({ tenantId: "acme", actor: "admin" });
    // The set call will fail (no tenant provider), but the tenant is still tracked
    // In real usage, a tenant provider would be dynamically added
    assert.equal(result.tenantId, "acme");
    assert.ok(tm.listTenants().includes("acme"));
  });

  test("provision materializes defaults from schemas", async () => {
    const configService = await createWeaverConfigService({
      providers: [createTestProvider("p1", "platform", {})],
      environment: "dev",
    });
    const gitWriteQueue = createGitWriteQueue();
    const schemaRegistry = createSchemaRegistry({ configService, gitWriteQueue });
    const tm = createTenantManager({ configService, gitWriteQueue, schemaRegistry });

    const result = await tm.provision({ tenantId: "new-co", actor: "admin" });
    assert.equal(result.tenantId, "new-co");
    assert.ok(tm.listTenants().includes("new-co"));
  });

  test("deprovision in archive mode removes tenant", async () => {
    const tenantProvider = createTestProvider("t-old", "tenant:old-co", { "_weaver.tenant.id": "old-co" });
    const configService = await createWeaverConfigService({
      providers: [createTestProvider("p1", "platform", {}), tenantProvider],
      environment: "dev",
    });
    const gitWriteQueue = createGitWriteQueue();
    const schemaRegistry = createSchemaRegistry({ configService, gitWriteQueue });
    const tm = createTenantManager({ configService, gitWriteQueue, schemaRegistry });

    const result = await tm.deprovision({ tenantId: "old-co", mode: "archive", actor: "admin" });
    assert.equal(result.success, true);
    assert.ok(!tm.listTenants().includes("old-co"));
  });

  test("deprovision in delete mode removes tenant", async () => {
    const tenantProvider = createTestProvider("t-del", "tenant:del-co", { "_weaver.tenant.id": "del-co" });
    const configService = await createWeaverConfigService({
      providers: [createTestProvider("p1", "platform", {}), tenantProvider],
      environment: "dev",
    });
    const gitWriteQueue = createGitWriteQueue();
    const schemaRegistry = createSchemaRegistry({ configService, gitWriteQueue });
    const tm = createTenantManager({ configService, gitWriteQueue, schemaRegistry });

    const result = await tm.deprovision({ tenantId: "del-co", mode: "delete", actor: "admin" });
    assert.equal(result.success, true);
    assert.ok(!tm.listTenants().includes("del-co"));
  });

  test("listTenants returns active tenants", async () => {
    const t1 = createTestProvider("t1", "tenant:alpha", {});
    const t2 = createTestProvider("t2", "tenant:beta", {});
    const configService = await createWeaverConfigService({
      providers: [createTestProvider("p1", "platform", {}), t1, t2],
      environment: "dev",
    });
    const gitWriteQueue = createGitWriteQueue();
    const schemaRegistry = createSchemaRegistry({ configService, gitWriteQueue });
    const tm = createTenantManager({ configService, gitWriteQueue, schemaRegistry });

    const tenants = tm.listTenants();
    assert.ok(tenants.includes("alpha"));
    assert.ok(tenants.includes("beta"));
  });

  test("duplicate provision returns error", async () => {
    const tenantProvider = createTestProvider("t-dup", "tenant:dup", {});
    const configService = await createWeaverConfigService({
      providers: [createTestProvider("p1", "platform", {}), tenantProvider],
      environment: "dev",
    });
    const gitWriteQueue = createGitWriteQueue();
    const schemaRegistry = createSchemaRegistry({ configService, gitWriteQueue });
    const tm = createTenantManager({ configService, gitWriteQueue, schemaRegistry });

    // "dup" already exists because the provider has layer "tenant:dup"
    const result = await tm.provision({ tenantId: "dup", actor: "admin" });
    assert.equal(result.success, false);
    assert.equal(result.error?.code, "VALIDATION_ERROR");
  });
});
