import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  scopeDefinitionSchema,
  scopeInstanceSchema,
  configurationContextSchema,
  configurationLayerEntrySchema,
  configurationLayerDataSchema,
} from "../src/schemas-layers.js";

describe("scopeDefinitionSchema", () => {
  it("accepts valid scope definition", () => {
    const result = scopeDefinitionSchema.safeParse({
      id: "org",
      label: "Organization",
    });
    assert.equal(result.success, true);
  });

  it("accepts optional parentScopeId", () => {
    const result = scopeDefinitionSchema.safeParse({
      id: "team",
      label: "Team",
      parentScopeId: "org",
    });
    assert.equal(result.success, true);
  });

  it("rejects missing required fields", () => {
    const result = scopeDefinitionSchema.safeParse({ id: "x" });
    assert.equal(result.success, false);
  });
});

describe("scopeInstanceSchema", () => {
  it("accepts valid instance", () => {
    const result = scopeInstanceSchema.safeParse({ scopeId: "org", value: "acme" });
    assert.equal(result.success, true);
  });

  it("rejects non-string value", () => {
    const result = scopeInstanceSchema.safeParse({ scopeId: "org", value: 123 });
    assert.equal(result.success, false);
  });
});

describe("configurationContextSchema", () => {
  it("accepts valid context", () => {
    const result = configurationContextSchema.safeParse({
      scopePath: [{ scopeId: "org", value: "acme" }],
      userId: "u1",
      deviceId: "d1",
    });
    assert.equal(result.success, true);
  });

  it("rejects missing userId", () => {
    const result = configurationContextSchema.safeParse({
      scopePath: [],
      deviceId: "d1",
    });
    assert.equal(result.success, false);
  });
});

describe("configurationLayerEntrySchema", () => {
  it("accepts valid entry", () => {
    const result = configurationLayerEntrySchema.safeParse({
      layer: "defaults",
      entries: { "app.theme": "dark" },
    });
    assert.equal(result.success, true);
  });
});

describe("configurationLayerDataSchema", () => {
  it("accepts entries with optional revision", () => {
    const result = configurationLayerDataSchema.safeParse({
      entries: { key: "value" },
      revision: "abc123",
    });
    assert.equal(result.success, true);
  });

  it("accepts entries without optional fields", () => {
    const result = configurationLayerDataSchema.safeParse({
      entries: {},
    });
    assert.equal(result.success, true);
  });
});
