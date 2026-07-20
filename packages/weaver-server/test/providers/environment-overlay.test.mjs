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
    expect(result.entries).toEqual({ host: "localhost", port: 3000 });
    expect(result.sources.get("host").isOverlay).toBe(false);
    expect(result.sources.get("host").environment).toBe("base");
  });

  it("base + env overlay: env keys override base", async () => {
    const provider = createMockEnvProvider("p1", "defaults", {
      base: { host: "localhost", port: 3000 },
      staging: { host: "staging.example.com" },
    });
    const result = await mergeWithEnvironment(provider, "staging");
    expect(result.entries.host).toBe("staging.example.com");
    expect(result.entries.port).toBe(3000);
    expect(result.sources.get("host").isOverlay).toBe(true);
    expect(result.sources.get("host").environment).toBe("staging");
    expect(result.sources.get("port").isOverlay).toBe(false);
  });

  it("env overlay adds new keys with isOverlay=true", async () => {
    const provider = createMockEnvProvider("p1", "defaults", {
      base: { host: "localhost" },
      staging: { debug: true },
    });
    const result = await mergeWithEnvironment(provider, "staging");
    expect(result.entries.debug).toBe(true);
    expect(result.sources.get("debug").isOverlay).toBe(true);
  });

  it("deep merge of nested objects", async () => {
    const provider = createMockEnvProvider("p1", "defaults", {
      base: { a: { b: 1 } },
      staging: { a: { c: 2 } },
    });
    const result = await mergeWithEnvironment(provider, "staging");
    expect(result.entries.a).toEqual({ b: 1, c: 2 });
  });

  it("env null clears base value", async () => {
    const provider = createMockEnvProvider("p1", "defaults", {
      base: { a: 1 },
      staging: { a: null },
    });
    const result = await mergeWithEnvironment(provider, "staging");
    expect(result.entries.a).toBe(null);
    expect(result.sources.get("a").isOverlay).toBe(true);
  });

  it("empty env overlay: merged === base", async () => {
    const provider = createMockEnvProvider("p1", "defaults", {
      base: { x: 42 },
      staging: {},
    });
    const result = await mergeWithEnvironment(provider, "staging");
    expect(result.entries).toEqual({ x: 42 });
    expect(result.sources.get("x").isOverlay).toBe(false);
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
    expect(data.entries).toEqual({ a: 2, b: 3 });
  });

  it("sources map is populated after load()", async () => {
    const provider = createMockEnvProvider("p1", "defaults", {
      base: { a: 1 },
      staging: { b: 2 },
    });
    const wrapped = withEnvironmentOverlay({ provider, environment: "staging" });
    await wrapped.load();
    expect(wrapped.sources.get("a").isOverlay).toBe(false);
    expect(wrapped.sources.get("b").isOverlay).toBe(true);
  });

  it("id and layer pass through from wrapped provider", () => {
    const provider = createMockEnvProvider("my-id", "my-layer", { base: {} });
    const wrapped = withEnvironmentOverlay({ provider, environment: "prod" });
    expect(wrapped.id).toBe("my-id");
    expect(wrapped.layer).toBe("my-layer");
  });

  it("writable passes through", () => {
    const provider = createMockEnvProvider("p1", "l", { base: {} });
    const wrapped = withEnvironmentOverlay({ provider, environment: "prod" });
    expect(wrapped.writable).toBe(false);
  });

  it("write() delegates to underlying provider", async () => {
    const provider = createMockEnvProvider("p1", "l", { base: {} });
    const wrapped = withEnvironmentOverlay({ provider, environment: "prod" });
    const result = await wrapped.write("key", "val");
    expect(result).toEqual({ success: false });
  });

  it("remove() delegates to underlying provider", async () => {
    const provider = createMockEnvProvider("p1", "l", { base: {} });
    const wrapped = withEnvironmentOverlay({ provider, environment: "prod" });
    const result = await wrapped.remove("key");
    expect(result).toEqual({ success: false });
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
    expect(src.environment).toBe("base");
    expect(src.isOverlay).toBe(false);
    expect(src.layer).toBe("app");
  });

  it("overlay key has environment='staging', isOverlay=true", async () => {
    const provider = createMockEnvProvider("p1", "app", {
      base: { x: 1 },
      staging: { y: 2 },
    });
    const result = await mergeWithEnvironment(provider, "staging");
    const src = result.sources.get("y");
    expect(src.environment).toBe("staging");
    expect(src.isOverlay).toBe(true);
    expect(src.layer).toBe("app");
  });

  it("key in both base and overlay: source shows overlay", async () => {
    const provider = createMockEnvProvider("p1", "app", {
      base: { shared: "base-val" },
      staging: { shared: "staging-val" },
    });
    const result = await mergeWithEnvironment(provider, "staging");
    const src = result.sources.get("shared");
    expect(src.environment).toBe("staging");
    expect(src.isOverlay).toBe(true);
  });
});
