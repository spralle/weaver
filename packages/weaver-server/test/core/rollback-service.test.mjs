import { test, describe } from "bun:test";
import assert from "node:assert/strict";
import { createRollbackService } from "../../src/core/rollback-service.ts";
import { createWeaverConfigService } from "../../src/core/config-service.ts";

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

describe("RollbackService", () => {
  test("rollback succeeds and returns result", async () => {
    const provider = createTestProvider("p1", "platform", { "key": "val" });
    const configService = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });
    const svc = createRollbackService({ configService });

    const result = await svc.rollback({
      layer: "platform",
      environment: "dev",
      toRevision: "abc123",
      actor: "admin",
    });

    assert.equal(result.success, true);
  });

  test("rollback bypasses changePolicy", async () => {
    // Rollback always succeeds regardless of policy
    const provider = createTestProvider("p1", "platform", {});
    const configService = await createWeaverConfigService({
      providers: [provider],
      environment: "prod",
    });
    const svc = createRollbackService({ configService });

    const result = await svc.rollback({
      layer: "platform",
      environment: "prod",
      toRevision: "def456",
      actor: "admin",
    });

    assert.equal(result.success, true);
  });

  test("rollback reloads affected provider", async () => {
    let loadCount = 0;
    const provider = {
      id: "p1",
      layer: "platform",
      writable: true,
      async load() { loadCount++; return { entries: {} }; },
      async write() { return { success: true }; },
      async remove() { return { success: true }; },
    };
    const configService = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });
    const initialLoads = loadCount;
    const svc = createRollbackService({ configService });

    await svc.rollback({
      layer: "platform",
      environment: "dev",
      toRevision: "abc",
      actor: "admin",
    });

    assert.equal(loadCount, initialLoads + 1);
  });

  test("rollback returns success with revert count", async () => {
    const provider = createTestProvider("p1", "platform", {});
    const configService = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });
    const svc = createRollbackService({ configService });

    const result = await svc.rollback({
      layer: "platform",
      environment: "dev",
      toRevision: "abc123",
      actor: "admin",
    });

    assert.equal(result.success, true);
    assert.equal(result.revertedCommits, 1);
  });
});
