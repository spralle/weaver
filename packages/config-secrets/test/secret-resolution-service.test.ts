import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SecretProvider } from "../src/secret-provider.js";
import { createSecretResolutionService } from "../src/secret-resolution-service.js";

function mockProvider(
  name: string,
  secrets: Record<string, string>,
): SecretProvider {
  return {
    name,
    async resolve(ref) {
      const val = secrets[ref.uri];
      if (!val) throw new Error(`Not found: ${ref.uri}`);
      return { value: val, version: "v1" };
    },
    async store(uri, value) {
      secrets[uri] = value;
      return { uri, version: "v2" };
    },
    async delete(uri) {
      delete secrets[uri];
    },
    async healthCheck() {
      return { healthy: true, latencyMs: 1 };
    },
  };
}

describe("SecretResolutionService", () => {
  it("resolves a secret from a registered provider", async () => {
    const svc = createSecretResolutionService();
    svc.registerProvider(mockProvider("vault", { "db/password": "s3cret" }));
    const val = await svc.resolve({
      _weaver: "secret-ref",
      provider: "vault",
      uri: "db/password",
    });
    assert.equal(val, "s3cret");
  });

  it("returns error for unregistered provider", async () => {
    const svc = createSecretResolutionService();
    const result = await svc.resolveResult({
      _weaver: "secret-ref",
      provider: "nope",
      uri: "x",
    });
    assert.equal(result.ok, false);
  });

  it("caches resolved secrets", async () => {
    let callCount = 0;
    const provider: SecretProvider = {
      name: "counting",
      async resolve() {
        callCount++;
        return { value: "v" };
      },
      async store() {
        return { uri: "", version: "" };
      },
      async delete() {},
      async healthCheck() {
        return { healthy: true, latencyMs: 0 };
      },
    };
    const svc = createSecretResolutionService();
    svc.registerProvider(provider);
    const ref = {
      _weaver: "secret-ref" as const,
      provider: "counting",
      uri: "k",
    };
    await svc.resolve(ref);
    await svc.resolve(ref);
    assert.equal(callCount, 1);
  });

  it("resolveAll handles mixed success and failure", async () => {
    const svc = createSecretResolutionService();
    svc.registerProvider(mockProvider("vault", { a: "val-a" }));
    const entries = {
      good: { _weaver: "secret-ref" as const, provider: "vault", uri: "a" },
      bad: {
        _weaver: "secret-ref" as const,
        provider: "vault",
        uri: "missing",
      },
      plain: "not-a-secret",
    };
    const result = await svc.resolveAll(entries);
    assert.equal(result.resolved.get("good"), "val-a");
    assert.equal(result.failures.length, 1);
    const failure = result.failures[0];
    assert.ok(failure);
    assert.equal(failure.key, "bad");
  });

  it("store delegates to provider", async () => {
    const secrets: Record<string, string> = {};
    const svc = createSecretResolutionService();
    svc.registerProvider(mockProvider("vault", secrets));
    const result = await svc.store("vault", "new/key", "new-val");
    assert.equal(result.version, "v2");
    assert.equal(secrets["new/key"], "new-val");
  });

  it("delete removes from provider and invalidates cache", async () => {
    const secrets: Record<string, string> = { k: "v" };
    const svc = createSecretResolutionService();
    svc.registerProvider(mockProvider("vault", secrets));
    await svc.delete("vault", "k");
    assert.equal(secrets.k, undefined);
  });

  it("throws for store/delete on unregistered provider", async () => {
    const svc = createSecretResolutionService();
    await assert.rejects(() => svc.store("nope", "u", "v"));
    await assert.rejects(() => svc.delete("nope", "u"));
  });
});
