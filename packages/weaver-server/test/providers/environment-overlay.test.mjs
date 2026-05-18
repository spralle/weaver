import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeWithEnvironment,
  withEnvironmentOverlay,
} from "../../src/providers/environment-overlay.ts";

function createMockEnvProvider(id, layer, envData) {
  return {
    id,
    layer,
    writable: false,
    async load() {
      return { entries: envData["base"] ?? {} };
    },
    async write() {
      return { success: false };
    },
    async remove() {
      return { success: false };
    },
    async loadForEnvironment(env) {
      return { entries: envData[env] ?? {} };
    },
    async listEnvironments() {
      return Object.keys(envData);
    },
  };
}

describe("mergeWithEnvironment", () => {
  it("base only (env='base') returns base entries with isOverlay=false", async () => {
    const provider = createMockEnvProvider("p1", "defaults", {
      base: { host: "localhost", port: 3000 },
    });
    const result = await mergeWithEnvironment(provider, "base");
    assert.deepEqual(result.entries, { host: "localhost", port: 3000 });
    assert.equal(result.sources.get("host").isOverlay, false);
    assert.equal(result.sources.get("host").environment, "base");
  });

  it("base + env overlay: env keys override base", async () => {
    const provider = createMockEnvProvider("p1", "defaults", {
      base: { host: "localhost", port: 3000 },
      staging: { host: "staging.example.com" },
    });
    const result = await mergeWithEnvironment(provider, "staging");
    assert.equal(result.entries.host, "staging.example.com");
    assert.equal(result.entries.port, 3000);
    assert.equal(result.sources.get("host").isOverlay, true);
    assert.equal(result.sources.get("host").environment, "staging");
    assert.equal(result.sources.get("port").isOverlay, false);
  });

  it("env overlay adds new keys with isOverlay=true", async () => {
    const provider = createMockEnvProvider("p1", "defaults", {
      base: { host: "localhost" },
      staging: { debug: true },
    });
    const result = await mergeWithEnvironment(provider, "staging");
    assert.equal(result.entries.debug, true);
    assert.equal(result.sources.get("debug").isOverlay, true);
  });

  it("deep merge of nested objects", async () => {
    const provider = createMockEnvProvider("p1", "defaults", {
      base: { a: { b: 1 } },
      staging: { a: { c: 2 } },
    });
    const result = await mergeWithEnvironment(provider, "staging");
    assert.deepEqual(result.entries.a, { b: 1, c: 2 });
  });

  it("env null clears base value", async () => {
    const provider = createMockEnvProvider("p1", "defaults", {
      base: { a: 1 },
      staging: { a: null },
    });
    const result = await mergeWithEnvironment(provider, "staging");
    assert.equal(result.entries.a, null);
    assert.equal(result.sources.get("a").isOverlay, true);
  });

  it("empty env overlay: merged === base", async () => {
    const provider = createMockEnvProvider("p1", "defaults", {
      base: { x: 42 },
      staging: {},
    });
    const result = await mergeWithEnvironment(provider, "staging");
    assert.deepEqual(result.entries, { x: 42 });
    assert.equal(result.sources.get("x").isOverlay, false);
  });
});

describe("withEnvironmentOverlay", () => {
  it("load() returns merged entries", async () => {
    const provider = createMockEnvProvider("p1", "defaults", {
      base: { a: 1 },
      staging: { a: 2, b: 3 },
    });
    const wrapped = withEnvironmentOverlay({ provider, environment: "staging" });
    const data = await wrapped.load();
    assert.deepEqual(data.entries, { a: 2, b: 3 });
  });

  it("sources map is populated after load()", async () => {
    const provider = createMockEnvProvider("p1", "defaults", {
      base: { a: 1 },
      staging: { b: 2 },
    });
    const wrapped = withEnvironmentOverlay({ provider, environment: "staging" });
    await wrapped.load();
    assert.equal(wrapped.sources.get("a").isOverlay, false);
    assert.equal(wrapped.sources.get("b").isOverlay, true);
  });

  it("id and layer pass through from wrapped provider", () => {
    const provider = createMockEnvProvider("my-id", "my-layer", { base: {} });
    const wrapped = withEnvironmentOverlay({ provider, environment: "prod" });
    assert.equal(wrapped.id, "my-id");
    assert.equal(wrapped.layer, "my-layer");
  });

  it("writable passes through", () => {
    const provider = createMockEnvProvider("p1", "l", { base: {} });
    const wrapped = withEnvironmentOverlay({ provider, environment: "prod" });
    assert.equal(wrapped.writable, false);
  });

  it("write() delegates to underlying provider", async () => {
    const provider = createMockEnvProvider("p1", "l", { base: {} });
    const wrapped = withEnvironmentOverlay({ provider, environment: "prod" });
    const result = await wrapped.write("key", "val");
    assert.deepEqual(result, { success: false });
  });

  it("remove() delegates to underlying provider", async () => {
    const provider = createMockEnvProvider("p1", "l", { base: {} });
    const wrapped = withEnvironmentOverlay({ provider, environment: "prod" });
    const result = await wrapped.remove("key");
    assert.deepEqual(result, { success: false });
  });
});

describe("provenance accuracy", () => {
  it("base-only key has environment='base', isOverlay=false", async () => {
    const provider = createMockEnvProvider("p1", "app", {
      base: { x: 1 },
      staging: { y: 2 },
    });
    const result = await mergeWithEnvironment(provider, "staging");
    const src = result.sources.get("x");
    assert.equal(src.environment, "base");
    assert.equal(src.isOverlay, false);
    assert.equal(src.layer, "app");
  });

  it("overlay key has environment='staging', isOverlay=true", async () => {
    const provider = createMockEnvProvider("p1", "app", {
      base: { x: 1 },
      staging: { y: 2 },
    });
    const result = await mergeWithEnvironment(provider, "staging");
    const src = result.sources.get("y");
    assert.equal(src.environment, "staging");
    assert.equal(src.isOverlay, true);
    assert.equal(src.layer, "app");
  });

  it("key in both base and overlay: source shows overlay", async () => {
    const provider = createMockEnvProvider("p1", "app", {
      base: { shared: "base-val" },
      staging: { shared: "staging-val" },
    });
    const result = await mergeWithEnvironment(provider, "staging");
    const src = result.sources.get("shared");
    assert.equal(src.environment, "staging");
    assert.equal(src.isOverlay, true);
  });
});
