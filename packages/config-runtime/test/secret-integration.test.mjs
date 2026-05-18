import test from "node:test";
import assert from "node:assert/strict";
import { createSecretIntegration } from "../dist/secret-integration.js";
import { createConfigurationService } from "../dist/configuration-service.js";
import { StaticJsonStorageProvider } from "../../config-providers/dist/static-json-provider.js";
import { defineWeaver, Layers } from "@weaver/config-types";

function createMockSecretService(secrets) {
  return {
    registerProvider() {},
    async resolve(ref) {
      const key = `${ref.provider}:${ref.uri}`;
      const value = secrets[key];
      if (!value) throw new Error(`Secret not found: ${key}`);
      return value;
    },
    async resolveAll(entries) {
      const result = new Map();
      for (const [key, val] of Object.entries(entries)) {
        if (val && typeof val === "object" && val._weaver === "secret-ref") {
          const skey = `${val.provider}:${val.uri}`;
          const resolved = secrets[skey];
          if (resolved) result.set(key, resolved);
        }
      }
      return result;
    },
    async store(provider, uri, value) {
      secrets[`${provider}:${uri}`] = value;
      return { version: "1" };
    },
    invalidate() {},
    invalidateAll() {},
    shutdown() {},
  };
}

const testConfig = defineWeaver([
  Layers.Static("core"),
  Layers.Static("app"),
]);

// --- Unit tests for createSecretIntegration ---

test("getResolved returns undefined for non-secret key", async () => {
  const service = createMockSecretService({});
  const handle = await createSecretIntegration(
    { "app.name": "weaver" },
    { service },
  );
  assert.equal(handle.getResolved("app.name"), undefined);
  handle.dispose();
});

test("getResolved returns plaintext for pre-resolved secret", async () => {
  const service = createMockSecretService({ "vault:db-pass": "s3cret" });
  const handle = await createSecretIntegration(
    { "db.password": { _weaver: "secret-ref", provider: "vault", uri: "db-pass" } },
    { service },
  );
  assert.equal(handle.getResolved("db.password"), "s3cret");
  handle.dispose();
});

test("hasSecret returns true for secret keys", async () => {
  const service = createMockSecretService({ "vault:key": "val" });
  const handle = await createSecretIntegration(
    { "secret.key": { _weaver: "secret-ref", provider: "vault", uri: "key" } },
    { service },
  );
  assert.equal(handle.hasSecret("secret.key"), true);
  handle.dispose();
});

test("hasSecret returns false for non-secret keys", async () => {
  const service = createMockSecretService({});
  const handle = await createSecretIntegration(
    { "plain.key": "hello" },
    { service },
  );
  assert.equal(handle.hasSecret("plain.key"), false);
  handle.dispose();
});

test("storeAsSecret returns SecretReference", async () => {
  const secrets = {};
  const service = createMockSecretService(secrets);
  const handle = await createSecretIntegration({}, { service });
  const ref = await handle.storeAsSecret("vault", "new-secret", "myvalue");
  assert.deepEqual(ref, { _weaver: "secret-ref", provider: "vault", uri: "new-secret" });
  assert.equal(secrets["vault:new-secret"], "myvalue");
  handle.dispose();
});

test("refresh re-resolves with new entries", async () => {
  const service = createMockSecretService({
    "vault:a": "alpha",
    "vault:b": "beta",
  });
  const handle = await createSecretIntegration(
    { "key.a": { _weaver: "secret-ref", provider: "vault", uri: "a" } },
    { service },
  );
  assert.equal(handle.getResolved("key.a"), "alpha");
  assert.equal(handle.hasSecret("key.b"), false);

  await handle.refresh({
    "key.b": { _weaver: "secret-ref", provider: "vault", uri: "b" },
  });
  assert.equal(handle.getResolved("key.b"), "beta");
  assert.equal(handle.hasSecret("key.a"), false); // old key gone after refresh
  handle.dispose();
});

test("dispose does not throw", async () => {
  const service = createMockSecretService({});
  const handle = await createSecretIntegration({}, { service, refreshIntervalMs: 1000 });
  handle.dispose();
  // No assertion needed — just verifying no error
});

// --- Integration tests with configuration service ---

test("get() resolves SecretReference transparently", async () => {
  const service = createMockSecretService({ "vault:api-key": "key-123" });
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {
      "api.key": { _weaver: "secret-ref", provider: "vault", uri: "api-key" },
      "app.name": "weaver",
    },
  });

  const svc = await createConfigurationService({
    providers: [core],
    weaverConfig: testConfig,
    secrets: { service },
  });

  assert.equal(svc.get("api.key"), "key-123");
  assert.equal(svc.get("app.name"), "weaver");
});

test("getWithDefault() falls back when secret not resolved", async () => {
  // Secret that fails to resolve (not in mock)
  const service = createMockSecretService({});
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {
      "missing.secret": { _weaver: "secret-ref", provider: "vault", uri: "missing" },
    },
  });

  const svc = await createConfigurationService({
    providers: [core],
    weaverConfig: testConfig,
    secrets: { service },
  });

  // hasSecret is true but getResolved returns undefined (failed resolution)
  assert.equal(svc.getWithDefault("missing.secret", "fallback"), "fallback");
});

test("inspect() shows secretResolved for secret keys", async () => {
  const service = createMockSecretService({ "vault:token": "tok-abc" });
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {
      "auth.token": { _weaver: "secret-ref", provider: "vault", uri: "token" },
    },
  });

  const svc = await createConfigurationService({
    providers: [core],
    weaverConfig: testConfig,
    secrets: { service },
  });

  const inspection = svc.inspect("auth.token");
  assert.equal(inspection.secretResolved, true);
  assert.equal(inspection.effectiveValue, "tok-abc");
});

test("backward compat: service without secrets option works as before", async () => {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: { "app.name": "weaver" },
  });

  const svc = await createConfigurationService({
    providers: [core],
    weaverConfig: testConfig,
  });

  assert.equal(svc.get("app.name"), "weaver");
  assert.equal(svc.get("missing"), undefined);
});
