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

function createRevertableProvider(id, layer, entries, revertResult = { revertedCommits: 1 }) {
  const calls = [];
  const provider = createTestProvider(id, layer, entries);
  provider.revert = async (toRevision, actor) => {
    calls.push({ toRevision, actor });
    return revertResult;
  };
  provider._revertCalls = calls;
  return provider;
}

describe("RollbackService", () => {
  test("rollback succeeds and returns result", async () => {
    const provider = createRevertableProvider("p1", "platform", { "key": "val" });
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

    expect(result.success).toBe(true);
  });

  test("rollback bypasses changePolicy", async () => {
    const provider = createRevertableProvider("p1", "platform", {});
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

    expect(result.success).toBe(true);
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
      async revert() { return { revertedCommits: 1 }; },
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

    expect(loadCount).toBe(initialLoads + 1);
  });

  test("rollback calls provider.revert with correct args", async () => {
    const provider = createRevertableProvider("p1", "platform", {});
    const configService = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });
    const svc = createRollbackService({ configService });

    await svc.rollback({
      layer: "platform",
      environment: "dev",
      toRevision: "abc123",
      actor: "admin",
    });

    expect(provider._revertCalls.length).toBe(1);
    expect(provider._revertCalls[0].toRevision).toBe("abc123");
    expect(provider._revertCalls[0].actor).toBe("admin");
  });

  test("rollback returns actual revertedCommits count", async () => {
    const provider = createRevertableProvider("p1", "platform", {}, { revertedCommits: 3 });
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

    expect(result.success).toBe(true);
    expect(result.revertedCommits).toBe(3);
  });

  test("rollback fails when provider does not support revert", async () => {
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

    expect(result.success).toBe(false);
    expect(result.revertedCommits).toBe(0);
    expect(result.error).toBeTruthy();
  });

  test("rollback fails when no provider for layer", async () => {
    const provider = createRevertableProvider("p1", "platform", {});
    const configService = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });
    const svc = createRollbackService({ configService });

    const result = await svc.rollback({
      layer: "nonexistent",
      environment: "dev",
      toRevision: "abc123",
      actor: "admin",
    });

    expect(result.success).toBe(false);
    expect(result.revertedCommits).toBe(0);
  });
});
