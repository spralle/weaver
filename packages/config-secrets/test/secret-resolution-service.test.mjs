import test from "node:test";
import assert from "node:assert/strict";
import { SecretResolutionService } from "../dist/index.js";

function createMockProvider(name, secrets = {}) {
  return {
    name,
    async resolve(ref) {
      const value = secrets[ref.uri];
      if (!value) throw new Error(`Not found: ${ref.uri}`);
      return { value, version: "v1" };
    },
    async store(uri, value) {
      secrets[uri] = value;
      return { uri, version: "v1" };
    },
    async delete(uri) {
      delete secrets[uri];
    },
    async healthCheck() {
      return { healthy: true, latencyMs: 1 };
    },
  };
}

test("SecretResolutionService can be instantiated", () => {
  const svc = new SecretResolutionService();
  assert.ok(svc);
});

test("registerProvider works", () => {
  const svc = new SecretResolutionService();
  const provider = createMockProvider("test");
  svc.registerProvider(provider);
  // No throw means success
  assert.ok(true);
});

test("resolve with a mock provider returns the value", async () => {
  const svc = new SecretResolutionService();
  svc.registerProvider(createMockProvider("test", { "my-secret": "s3cr3t" }));

  const value = await svc.resolve({
    _weaver: "secret-ref",
    provider: "test",
    uri: "my-secret",
  });
  assert.equal(value, "s3cr3t");
});

test("resolveAll scans entries and resolves secret references", async () => {
  const svc = new SecretResolutionService();
  svc.registerProvider(createMockProvider("test", { "db-pass": "hunter2" }));

  const results = await svc.resolveAll({
    plainKey: "not-a-secret",
    dbPassword: { _weaver: "secret-ref", provider: "test", uri: "db-pass" },
  });

  assert.equal(results.size, 1);
  assert.equal(results.get("dbPassword"), "hunter2");
});

test("cache is used on second resolve (mock provider called once)", async () => {
  let callCount = 0;
  const provider = {
    name: "counting",
    async resolve(_ref) {
      callCount++;
      return { value: "cached-val", version: "v1" };
    },
    async store() { return { uri: "", version: "" }; },
    async delete() {},
    async healthCheck() { return { healthy: true, latencyMs: 0 }; },
  };

  const svc = new SecretResolutionService();
  svc.registerProvider(provider);

  const ref = { _weaver: "secret-ref", provider: "counting", uri: "x" };
  await svc.resolve(ref);
  await svc.resolve(ref);

  assert.equal(callCount, 1);
});

// --- Provider management ---

test("registerProvider() with duplicate name overwrites previous", async () => {
  const svc = new SecretResolutionService();
  svc.registerProvider(createMockProvider("test", { "k": "old" }));
  svc.registerProvider(createMockProvider("test", { "k": "new" }));

  const val = await svc.resolve({ _weaver: "secret-ref", provider: "test", uri: "k" });
  assert.equal(val, "new");
});

test("resolve() with unknown provider throws", async () => {
  const svc = new SecretResolutionService();
  await assert.rejects(
    () => svc.resolve({ _weaver: "secret-ref", provider: "nope", uri: "x" }),
    /not registered/,
  );
});

test("resolve() with provider that throws returns error", async () => {
  const svc = new SecretResolutionService();
  svc.registerProvider({
    name: "failing",
    async resolve() { throw new Error("vault down"); },
    async store() { return { uri: "", version: "" }; },
    async delete() {},
    async healthCheck() { return { healthy: false, latencyMs: 0 }; },
  });
  await assert.rejects(
    () => svc.resolve({ _weaver: "secret-ref", provider: "failing", uri: "x" }),
    /vault down/,
  );
});

// --- Resolution ---

test("resolveAll() with mixed entries only resolves secret refs", async () => {
  const svc = new SecretResolutionService();
  svc.registerProvider(createMockProvider("test", { "s1": "secret1" }));

  const results = await svc.resolveAll({
    plain: "hello",
    num: 42,
    secret: { _weaver: "secret-ref", provider: "test", uri: "s1" },
    nested: { foo: "bar" },
  });

  assert.equal(results.size, 1);
  assert.equal(results.get("secret"), "secret1");
});

test("resolveAll() with multiple providers routes correctly", async () => {
  const svc = new SecretResolutionService();
  svc.registerProvider(createMockProvider("aws", { "a": "aws-val" }));
  svc.registerProvider(createMockProvider("azure", { "b": "azure-val" }));

  const results = await svc.resolveAll({
    k1: { _weaver: "secret-ref", provider: "aws", uri: "a" },
    k2: { _weaver: "secret-ref", provider: "azure", uri: "b" },
  });

  assert.equal(results.get("k1"), "aws-val");
  assert.equal(results.get("k2"), "azure-val");
});

test("resolveAll() with empty entries returns empty map", async () => {
  const svc = new SecretResolutionService();
  const results = await svc.resolveAll({});
  assert.equal(results.size, 0);
});

// --- Store/delete ---

test("store() calls provider.store() with correct args", async () => {
  let storedUri, storedValue;
  const svc = new SecretResolutionService();
  svc.registerProvider({
    name: "test",
    async resolve() { return { value: "", version: "" }; },
    async store(uri, value) { storedUri = uri; storedValue = value; return { uri, version: "v2" }; },
    async delete() {},
    async healthCheck() { return { healthy: true, latencyMs: 0 }; },
  });

  const result = await svc.store("test", "my-key", "my-value");
  assert.equal(storedUri, "my-key");
  assert.equal(storedValue, "my-value");
  assert.equal(result.version, "v2");
});

test("delete() calls provider.delete() with correct args", async () => {
  let deletedUri;
  const svc = new SecretResolutionService();
  svc.registerProvider({
    name: "test",
    async resolve() { return { value: "", version: "" }; },
    async store() { return { uri: "", version: "" }; },
    async delete(uri) { deletedUri = uri; },
    async healthCheck() { return { healthy: true, latencyMs: 0 }; },
  });

  await svc.delete("test", "del-key");
  assert.equal(deletedUri, "del-key");
});

test("store() with unknown provider throws", async () => {
  const svc = new SecretResolutionService();
  await assert.rejects(
    () => svc.store("nope", "k", "v"),
    /not registered/,
  );
});

test("delete() with unknown provider throws", async () => {
  const svc = new SecretResolutionService();
  await assert.rejects(
    () => svc.delete("nope", "k"),
    /not registered/,
  );
});

// --- Cache invalidation ---

test("invalidate() removes cached value, next resolve() calls provider again", async () => {
  let callCount = 0;
  const svc = new SecretResolutionService();
  svc.registerProvider({
    name: "test",
    async resolve() { callCount++; return { value: "v", version: "v1" }; },
    async store() { return { uri: "", version: "" }; },
    async delete() {},
    async healthCheck() { return { healthy: true, latencyMs: 0 }; },
  });

  const ref = { _weaver: "secret-ref", provider: "test", uri: "x" };
  await svc.resolve(ref);
  assert.equal(callCount, 1);

  svc.invalidate("test:x:");
  await svc.resolve(ref);
  assert.equal(callCount, 2);
});

// --- Audit logging ---

test("when SecretAuditLog is provided, resolve() logs the access", async () => {
  const logs = [];
  const auditLog = { log(entry) { logs.push(entry); } };
  const svc = new SecretResolutionService({ auditLog });
  svc.registerProvider(createMockProvider("test", { "k": "v" }));

  await svc.resolve({ _weaver: "secret-ref", provider: "test", uri: "k" });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, "resolve");
  assert.equal(logs[0].provider, "test");
  assert.equal(logs[0].success, true);
});

test("when SecretAuditLog is provided, store() logs the operation", async () => {
  const logs = [];
  const auditLog = { log(entry) { logs.push(entry); } };
  const svc = new SecretResolutionService({ auditLog });
  svc.registerProvider(createMockProvider("test", {}));

  await svc.store("test", "k", "v");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, "store");
  assert.equal(logs[0].success, true);
});

test("when no audit log provided, operations still work", async () => {
  const svc = new SecretResolutionService();
  svc.registerProvider(createMockProvider("test", { "k": "v" }));
  const val = await svc.resolve({ _weaver: "secret-ref", provider: "test", uri: "k" });
  assert.equal(val, "v");
});
