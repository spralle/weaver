import test from "node:test";
import assert from "node:assert/strict";
import { createAzureKeyVaultProvider } from "../dist/index.js";

function createMockSecretClient(secretStore = new Map()) {
  return {
    async getSecret(name, _options) {
      if (!secretStore.has(name)) {
        const err = new Error(`Secret ${name} not found`);
        err.statusCode = 404;
        throw err;
      }
      return {
        value: secretStore.get(name),
        properties: { version: "v1", expiresOn: undefined },
      };
    },
    async setSecret(name, value) {
      secretStore.set(name, value);
      return {
        properties: { version: "v1" },
      };
    },
    async beginDeleteSecret(name) {
      secretStore.delete(name);
      return {};
    },
  };
}

/**
 * Creates a provider instance with an injected mock SecretClient.
 * We use the factory with a fake credential, then replace the internal client.
 */
function createProviderWithMock(secretStore = new Map(), options = {}) {
  const mockClient = createMockSecretClient(secretStore);
  const fakeCredential = { getToken: async () => ({ token: "fake", expiresOnTimestamp: Date.now() + 3600000 }) };
  const provider = createAzureKeyVaultProvider({
    vaultUrl: "https://fake-vault.vault.azure.net",
    credential: fakeCredential,
    secretPrefix: options.secretPrefix,
  });
  // Inject mock client via property override
  Object.defineProperty(provider, "client", { value: mockClient, writable: false, configurable: true });
  return { provider, mockClient, secretStore };
}

test("resolve() returns the secret value from vault", async () => {
  const store = new Map([["my-secret", "s3cr3t"]]);
  const { provider } = createProviderWithMock(store);

  const result = await provider.resolve({ _weaver: "secret-ref", provider: "azure-keyvault", uri: "my-secret" });
  assert.equal(result.value, "s3cr3t");
  assert.equal(result.version, "v1");
});

test("resolve() with non-existent secret throws", async () => {
  const { provider } = createProviderWithMock(new Map());

  await assert.rejects(
    () => provider.resolve({ _weaver: "secret-ref", provider: "azure-keyvault", uri: "missing" }),
    /not found/,
  );
});

test("store() persists the value", async () => {
  const store = new Map();
  const { provider } = createProviderWithMock(store);

  const result = await provider.store("new-key", "new-value");
  assert.equal(store.get("new-key"), "new-value");
  assert.equal(result.uri, "new-key");
  assert.equal(result.version, "v1");
});

test("delete() removes the value from vault", async () => {
  const store = new Map([["del-key", "val"]]);
  const { provider } = createProviderWithMock(store);

  await provider.delete("del-key");
  assert.equal(store.has("del-key"), false);
});

test("healthCheck() succeeds when vault is reachable (404 is healthy)", async () => {
  // healthCheck tries to get "health-check-dummy" which won't exist — 404 means healthy
  const { provider } = createProviderWithMock(new Map());

  const health = await provider.healthCheck();
  assert.equal(health.healthy, true);
});

test("healthCheck() fails when vault is unreachable", async () => {
  const { provider, mockClient } = createProviderWithMock(new Map());
  // Override getSecret to throw a non-404 error
  mockClient.getSecret = async () => { throw new Error("network timeout"); };

  const health = await provider.healthCheck();
  assert.equal(health.healthy, false);
  assert.match(health.message, /network timeout/);
});

test("secretPrefix option prepends prefix to secret names", async () => {
  const store = new Map([["myapp-my-secret", "prefixed-val"]]);
  const { provider } = createProviderWithMock(store, { secretPrefix: "myapp" });

  const result = await provider.resolve({ _weaver: "secret-ref", provider: "azure-keyvault", uri: "my-secret" });
  assert.equal(result.value, "prefixed-val");
});

test("secretPrefix applies to store operations", async () => {
  const store = new Map();
  const { provider } = createProviderWithMock(store, { secretPrefix: "pfx" });

  await provider.store("key1", "val1");
  assert.equal(store.has("pfx-key1"), true);
  assert.equal(store.get("pfx-key1"), "val1");
});

test("secretPrefix applies to delete operations", async () => {
  const store = new Map([["pfx-key1", "val"]]);
  const { provider } = createProviderWithMock(store, { secretPrefix: "pfx" });

  await provider.delete("key1");
  assert.equal(store.has("pfx-key1"), false);
});
