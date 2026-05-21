import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { validateOnRead, validateOnWrite } from "../src/validation.js";
import type { ClientSchemaRegistry, ValidationResult } from "../src/schema-registry.js";
import { createWeaverClient } from "../src/client.js";
import type { WeaverTransport } from "../src/transport.js";

function createMockRegistry(overrides: Partial<ClientSchemaRegistry> = {}): ClientSchemaRegistry {
  return {
    load: () => {},
    getSchema: () => undefined,
    isSensitive: () => false,
    getReloadBehavior: () => undefined,
    getRestartRequiredKeys: () => [],
    validate: () => ({ valid: true }),
    ...overrides,
  };
}

describe("validateOnRead", () => {
  it("passes valid value through", () => {
    const registry = createMockRegistry({ validate: () => ({ valid: true }) });
    const result = validateOnRead("key", 42, registry, { warnOnMismatch: true });
    assert.equal(result, 42);
  });

  it("returns value but warns on invalid", () => {
    const registry = createMockRegistry({
      validate: () => ({ valid: false, errors: [{ path: "", message: "bad type" }] }),
    });
    const warns: string[] = [];
    const logger = { warn: (msg: string) => warns.push(msg) };
    const result = validateOnRead("key", "bad", registry, { warnOnMismatch: true, logger });
    assert.equal(result, "bad");
    assert.equal(warns.length, 1);
    assert.ok(warns[0].includes("bad type"));
  });

  it("returns value as-is when no registry", () => {
    const result = validateOnRead("key", "hello", undefined, { warnOnMismatch: true });
    assert.equal(result, "hello");
  });

  it("suppresses warnings when warnOnMismatch is false", () => {
    const registry = createMockRegistry({
      validate: () => ({ valid: false, errors: [{ path: "", message: "bad" }] }),
    });
    const warns: string[] = [];
    const logger = { warn: (msg: string) => warns.push(msg) };
    const result = validateOnRead("key", "val", registry, { warnOnMismatch: false, logger });
    assert.equal(result, "val");
    assert.equal(warns.length, 0);
  });
});

describe("validateOnWrite", () => {
  it("returns valid for valid value", () => {
    const registry = createMockRegistry({ validate: () => ({ valid: true }) });
    const result = validateOnWrite("key", 42, registry);
    assert.deepEqual(result, { valid: true });
  });

  it("returns invalid for bad value", () => {
    const errors = [{ path: "", message: "Expected number, got string" }];
    const registry = createMockRegistry({ validate: () => ({ valid: false, errors }) });
    const result = validateOnWrite("key", "bad", registry);
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors, errors);
  });
});

function createMockTransport(overrides: Partial<WeaverTransport> = {}): WeaverTransport {
  return {
    resolveAll: async () => ({ entries: {}, scopes: {}, revision: "r1", timestamp: new Date().toISOString() }),
    resolve: async () => undefined,
    inspect: async () => ({ key: "", effectiveValue: undefined, layerValues: {} }),
    set: async () => ({ success: true, revision: "r2" }),
    setMany: async () => ({ success: true }),
    remove: async () => ({ success: true }),
    subscribe: () => () => {},
    listScopes: async () => [],
    listScopeValues: async () => [],
    close: async () => {},
    ...overrides,
  };
}

describe("client validation integration", () => {
  it("set() rejects invalid value without calling transport", async () => {
    let transportCalled = false;
    const transport = createMockTransport({
      set: async () => { transportCalled = true; return { success: true }; },
      resolveAll: async () => ({ entries: {}, scopes: {}, revision: "r1", timestamp: new Date().toISOString() }),
    });
    // Add fetchSchemas to transport
    (transport as Record<string, unknown>).fetchSchemas = async () => ({
      "app.port": { type: "number" as const },
    });

    const client = await createWeaverClient({ transport, schemas: true });
    const result = await client.set("app.port", "not-a-number");
    assert.equal(result.success, false);
    assert.equal(result.error?.code, "VALIDATION_ERROR");
    assert.equal(transportCalled, false);
  });

  it("set() allows valid value through to transport", async () => {
    let transportCalled = false;
    const transport = createMockTransport({
      set: async () => { transportCalled = true; return { success: true, revision: "r2" }; },
    });
    (transport as Record<string, unknown>).fetchSchemas = async () => ({
      "app.port": { type: "number" as const },
    });

    const client = await createWeaverClient({ transport, schemas: true });
    const result = await client.set("app.port", 8080);
    assert.equal(result.success, true);
    assert.equal(transportCalled, true);
  });

  it("validate() returns ValidationResult", async () => {
    const transport = createMockTransport();
    (transport as Record<string, unknown>).fetchSchemas = async () => ({
      "app.name": { type: "string" as const },
    });

    const client = await createWeaverClient({ transport, schemas: true });
    const valid = client.validate("app.name", "hello");
    assert.equal(valid.valid, true);
    const invalid = client.validate("app.name", 123);
    assert.equal(invalid.valid, false);
  });

  it("isSensitive() returns correct boolean", async () => {
    const transport = createMockTransport();
    (transport as Record<string, unknown>).fetchSchemas = async () => ({
      "db.password": { type: "string" as const, "x-weaver": { sensitive: true } },
      "app.name": { type: "string" as const },
    });

    const client = await createWeaverClient({ transport, schemas: true });
    assert.equal(client.isSensitive("db.password"), true);
    assert.equal(client.isSensitive("app.name"), false);
  });

  it("works without schemas option", async () => {
    const transport = createMockTransport();
    const client = await createWeaverClient({ transport });
    // validate/isSensitive still work, just return defaults
    assert.deepEqual(client.validate("any", "val"), { valid: true });
    assert.equal(client.isSensitive("any"), false);
  });
});
