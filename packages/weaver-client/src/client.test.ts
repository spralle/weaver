import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createWeaverClient } from "./client.js";
import { createLocalTransport } from "./local-transport.js";
import type { ConfigSnapshot } from "./types.js";

function makeSnapshot(entries: Record<string, unknown> = {}, scopes: Record<string, Record<string, unknown>> = {}): ConfigSnapshot {
  return { entries, scopes, revision: "rev-1", timestamp: new Date().toISOString() };
}

describe("WeaverClient", () => {
  it("get<T>() returns typed value from base state", async () => {
    const transport = createLocalTransport({ snapshot: makeSnapshot({ app: { name: "weaver" } }) });
    const client = await createWeaverClient({ transport });
    const value = client.get<string>("app.name");
    assert.equal(value, "weaver");
  });

  it("get<T>(key, scopePath) returns scoped value", async () => {
    const transport = createLocalTransport({
      snapshot: makeSnapshot(
        { app: { name: "base" } },
        { "scope:acme": { app: { name: "acme-app" } } },
      ),
    });
    const client = await createWeaverClient({ transport, scopeLoading: "eager" });
    const value = client.get<string>("app.name", [{ scopeId: "scope", value: "acme" }]);
    assert.equal(value, "acme-app");
  });

  it("getWithDefault() returns default when key missing", async () => {
    const transport = createLocalTransport({ snapshot: makeSnapshot() });
    const client = await createWeaverClient({ transport });
    const value = client.getWithDefault("missing.key", 42);
    assert.equal(value, 42);
  });

  it("getWithDefault() returns actual value when key exists", async () => {
    const transport = createLocalTransport({ snapshot: makeSnapshot({ app: { port: 8080 } }) });
    const client = await createWeaverClient({ transport });
    const value = client.getWithDefault("app.port", 3000);
    assert.equal(value, 8080);
  });

  it("getForScope() returns scoped value", async () => {
    const transport = createLocalTransport({
      snapshot: makeSnapshot(
        {},
        { "env:prod": { app: { debug: false } } },
      ),
    });
    const client = await createWeaverClient({ transport, scopeLoading: "eager" });
    const value = client.getForScope<boolean>("app.debug", [{ scopeId: "env", value: "prod" }]);
    assert.equal(value, false);
  });

  it("getNamespace() returns subtree", async () => {
    const transport = createLocalTransport({
      snapshot: makeSnapshot({ db: { host: "localhost", port: 5432 }, app: { name: "x" } }),
    });
    const client = await createWeaverClient({ transport });
    const ns = client.getNamespace("db");
    assert.deepEqual(ns, { host: "localhost", port: 5432 });
  });

  it("set() delegates to transport with namespace prefix", async () => {
    const transport = createLocalTransport({ snapshot: makeSnapshot() });
    const client = await createWeaverClient({ transport, namespace: "myapp" });
    const result = await client.set("key", "value");
    assert.equal(result.success, true);
  });

  it("remove() delegates to transport with namespace prefix", async () => {
    const transport = createLocalTransport({ snapshot: makeSnapshot({ app: { old: true } }) });
    const client = await createWeaverClient({ transport });
    const result = await client.remove("app.old");
    assert.equal(result.success, true);
  });

  it("listScopes() delegates to transport", async () => {
    const transport = createLocalTransport({
      snapshot: makeSnapshot({}, { "scope:acme": {} }),
    });
    const client = await createWeaverClient({ transport });
    const scopes = await client.listScopes();
    assert.ok(Array.isArray(scopes));
    assert.equal(scopes.length, 1);
    assert.equal(scopes[0]!.id, "scope");
  });

  it("listScopeValues() delegates to transport", async () => {
    const transport = createLocalTransport({
      snapshot: makeSnapshot({}, { "scope:acme": {}, "scope:beta": {} }),
    });
    const client = await createWeaverClient({ transport });
    const values = await client.listScopeValues("scope");
    assert.ok(values.includes("acme"));
    assert.ok(values.includes("beta"));
  });

  it("lastSyncedAt is set after initialization", async () => {
    const before = new Date();
    const transport = createLocalTransport({ snapshot: makeSnapshot() });
    const client = await createWeaverClient({ transport });
    const syncedAt = client.lastSyncedAt;
    assert.ok(syncedAt !== null);
    assert.ok(syncedAt >= before);
  });

  it("connected is true after init, false after close", async () => {
    const transport = createLocalTransport({ snapshot: makeSnapshot() });
    const client = await createWeaverClient({ transport });
    assert.equal(client.connected, true);
    await client.close();
    assert.equal(client.connected, false);
  });

  it("pendingRestart is false by default", async () => {
    const transport = createLocalTransport({ snapshot: makeSnapshot() });
    const client = await createWeaverClient({ transport });
    assert.equal(client.pendingRestart, false);
  });

  it("staleSince is null when connected, set after close", async () => {
    const transport = createLocalTransport({ snapshot: makeSnapshot() });
    const client = await createWeaverClient({ transport });
    assert.equal(client.staleSince, null);
    await client.close();
    assert.ok(client.staleSince !== null);
  });

  it("setMany() delegates to transport with namespace prefix", async () => {
    const transport = createLocalTransport({ snapshot: makeSnapshot() });
    const client = await createWeaverClient({ transport, namespace: "myapp" });
    const result = await client.setMany({ "db.host": "localhost", "db.port": 5432 });
    assert.equal(result.success, true);
  });

  it("setNamespace() flattens nested object and delegates to transport", async () => {
    const snapshot = makeSnapshot();
    const transport = createLocalTransport({ snapshot });
    const client = await createWeaverClient({ transport });
    const result = await client.setNamespace("db", { host: "localhost", port: 5432 });
    assert.equal(result.success, true);
    const dbHost = await transport.get("db.host");
    assert.equal(dbHost, "localhost");
    const dbPort = await transport.get("db.port");
    assert.equal(dbPort, 5432);
  });

  it("setNamespace() with client namespace applies both prefixes", async () => {
    const snapshot = makeSnapshot();
    const transport = createLocalTransport({ snapshot });
    const client = await createWeaverClient({ transport, namespace: "myapp" });
    const result = await client.setNamespace("db", { host: "localhost" });
    assert.equal(result.success, true);
    const value = await transport.get("myapp.db.host");
    assert.equal(value, "localhost");
  });
});
