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
