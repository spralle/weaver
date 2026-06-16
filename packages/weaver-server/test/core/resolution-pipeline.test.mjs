import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createWeaverConfigService } from "../../src/core/config-service.ts";
import { deepSet, deepRemove } from "@weaver-conf/config-engine";

function createTestProvider(id, layer, entries, writable = true) {
  let data = JSON.parse(JSON.stringify(entries));
  return {
    id,
    layer,
    writable,
    async load() { return { entries: JSON.parse(JSON.stringify(data)) }; },
    async write(key, value) {
      if (!writable) return { success: false, error: { code: "READONLY", message: "read-only" } };
      deepSet(data, key, value);
      return { success: true };
    },
    async remove(key) {
      if (!writable) return { success: false, error: { code: "READONLY", message: "read-only" } };
      deepRemove(data, key);
      return { success: true };
    },
  };
}

describe("Resolution pipeline", () => {
  test("get() resolves ConfigMount transparently", async () => {
    const entries = {
      shared: { dbUrl: "postgres://host/db" },
      myservice: { db: { _weaver: "mount", source: "shared.dbUrl" } },
    };
    const provider = createTestProvider("p1", "platform", entries);
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const value = await svc.get("myservice.db");
    assert.equal(value, "postgres://host/db");
  });

  test("get() resolves SecretReference transparently", async () => {
    const entries = {
      database: { password: { _weaver: "secret-ref", provider: "vault", uri: "db/pass" } },
    };
    const mockBackend = {
      resolve: async (ref) => ref.uri === "db/pass" ? "s3cr3t" : undefined,
    };
    const provider = createTestProvider("p1", "platform", entries);
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
      secretBackend: mockBackend,
    });

    const value = await svc.get("database.password");
    assert.equal(value, "s3cr3t");
  });

  test("get() resolves mount -> secret chain", async () => {
    const entries = {
      shared: { secret: { _weaver: "secret-ref", provider: "vault", uri: "shared/key" } },
      app: { apiKey: { _weaver: "mount", source: "shared.secret" } },
    };
    const mockBackend = {
      resolve: async (ref) => ref.uri === "shared/key" ? "api-key-value" : undefined,
    };
    const provider = createTestProvider("p1", "platform", entries);
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
      secretBackend: mockBackend,
    });

    const value = await svc.get("app.apiKey");
    assert.equal(value, "api-key-value");
  });

  test("getNamespace() resolves markers within namespace", async () => {
    const entries = {
      db: {
        host: "localhost",
        password: { _weaver: "secret-ref", provider: "vault", uri: "db/pass" },
        port: { _weaver: "mount", source: "shared.defaultPort" },
      },
      shared: { defaultPort: 5432 },
    };
    const mockBackend = {
      resolve: async (ref) => ref.uri === "db/pass" ? "secret123" : undefined,
    };
    const provider = createTestProvider("p1", "platform", entries);
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
      secretBackend: mockBackend,
    });

    const ns = await svc.getNamespace("db");
    assert.equal(ns.host, "localhost");
    assert.equal(ns.password, "secret123");
    assert.equal(ns.port, 5432);
  });

  test("resolveAll() returns clean entries (no markers)", async () => {
    const entries = {
      key: { _weaver: "secret-ref", provider: "vault", uri: "x" },
    };
    const mockBackend = {
      resolve: async () => "resolved",
    };
    const provider = createTestProvider("p1", "platform", entries);
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
      secretBackend: mockBackend,
    });

    const snapshot = await svc.resolveAll();
    assert.equal(snapshot.entries.key, "resolved");
  });

  test("without secretBackend, SecretReference markers pass through", async () => {
    const entries = {
      key: { _weaver: "secret-ref", provider: "vault", uri: "x" },
    };
    const provider = createTestProvider("p1", "platform", entries);
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const value = await svc.get("key");
    assert.deepEqual(value, { _weaver: "secret-ref", provider: "vault", uri: "x" });
  });

  test("mount cycle returns undefined gracefully", async () => {
    const entries = {
      a: { _weaver: "mount", source: "b" },
      b: { _weaver: "mount", source: "a" },
    };
    const provider = createTestProvider("p1", "platform", entries);
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const value = await svc.get("a");
    assert.equal(value, undefined);
  });

  test("mount map rebuilds after set", async () => {
    const entries = {
      shared: { value: "original" },
      app: { ref: { _weaver: "mount", source: "shared.value" } },
    };
    const provider = createTestProvider("p1", "platform", entries);
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    assert.equal(await svc.get("app.ref"), "original");

    await svc.set("platform", "shared.value", "updated");
    assert.equal(await svc.get("app.ref"), "updated");
  });

  test("resolveEntries handles nested objects without markers", async () => {
    const entries = {
      app: {
        nested: { deep: { value: 42 } },
      },
    };
    const provider = createTestProvider("p1", "platform", entries);
    const svc = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });

    const ns = await svc.getNamespace("app");
    assert.deepEqual(ns, { nested: { deep: { value: 42 } } });
  });
});
