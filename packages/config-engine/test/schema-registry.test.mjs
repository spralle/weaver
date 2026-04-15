import test from "node:test";
import assert from "node:assert/strict";
import { composeConfigurationSchemas, createSchemaRegistry } from "../dist/index.js";

test("composes from single declaration", () => {
  const result = composeConfigurationSchemas([
    {
      ownerId: "ghost.vesselView",
      namespace: "ghost.vesselView",
      properties: {
        theme: { type: "string", default: "dark" },
      },
    },
  ]);
  assert.equal(result.errors.length, 0);
  assert.equal(result.schemas.size, 1);
  assert.ok(result.schemas.has("ghost.vesselView.theme"));
  const entry = result.schemas.get("ghost.vesselView.theme");
  assert.equal(entry.ownerId, "ghost.vesselView");
  assert.equal(entry.fullyQualifiedKey, "ghost.vesselView.theme");
  assert.equal(entry.schema.type, "string");
});

test("composes from multiple declarations", () => {
  const result = composeConfigurationSchemas([
    {
      ownerId: "ghost.vesselView",
      namespace: "ghost.vesselView",
      properties: {
        theme: { type: "string" },
      },
    },
    {
      ownerId: "ghost.fleetMap",
      namespace: "ghost.fleetMap",
      properties: {
        zoom: { type: "number", default: 5 },
      },
    },
  ]);
  assert.equal(result.errors.length, 0);
  assert.equal(result.schemas.size, 2);
  assert.ok(result.schemas.has("ghost.vesselView.theme"));
  assert.ok(result.schemas.has("ghost.fleetMap.zoom"));
});

test("detects duplicate keys across declarations", () => {
  const result = composeConfigurationSchemas([
    {
      ownerId: "plugin-a",
      namespace: "ghost.vesselView",
      properties: {
        theme: { type: "string" },
      },
    },
    {
      ownerId: "plugin-b",
      namespace: "ghost.vesselView",
      properties: {
        theme: { type: "number" },
      },
    },
  ]);
  const duplicateErrors = result.errors.filter((e) => e.type === "duplicate-key");
  assert.equal(duplicateErrors.length, 1);
  assert.ok(duplicateErrors[0].ownerIds);
  assert.deepEqual(duplicateErrors[0].ownerIds, ["plugin-a", "plugin-b"]);
});

test("validates key format and reports errors", () => {
  const result = composeConfigurationSchemas([
    {
      ownerId: "bad-plugin",
      namespace: "ghost.bad",
      // relativeKey "1invalid" → qualified key "ghost.bad.1invalid" has invalid segment
      properties: {
        "1invalid": { type: "string" },
      },
    },
  ]);
  const formatErrors = result.errors.filter((e) => e.type === "invalid-key-format");
  assert.equal(formatErrors.length, 1);
  assert.ok(formatErrors[0].message.includes("1invalid"));
});

test("qualifies relative keys with namespace", () => {
  const result = composeConfigurationSchemas([
    {
      ownerId: "ghost.vesselView",
      namespace: "ghost.vesselView",
      properties: {
        "map.defaultZoom": { type: "number" },
      },
    },
  ]);
  assert.equal(result.errors.length, 0);
  assert.ok(result.schemas.has("ghost.vesselView.map.defaultZoom"));
});

test("handles declarations with no properties", () => {
  const result = composeConfigurationSchemas([
    {
      ownerId: "ghost.empty",
      namespace: "ghost.empty",
      properties: {},
    },
  ]);
  assert.equal(result.errors.length, 0);
  assert.equal(result.schemas.size, 0);
});

test("supports incremental register/get/getSchemasByOwner flows", () => {
  const registry = createSchemaRegistry();
  const registerResult = registry.register({
    ownerId: "ghost.vesselView",
    namespace: "ghost.vesselView",
    properties: {
      theme: { type: "string", default: "dark" },
      zoom: { type: "number", default: 5 },
    },
  });

  assert.equal(registerResult.errors.length, 0);
  assert.deepEqual(registerResult.registeredKeys, [
    "ghost.vesselView.theme",
    "ghost.vesselView.zoom",
  ]);

  const schema = registry.getSchema("ghost.vesselView.theme");
  assert.ok(schema);
  assert.equal(schema.ownerId, "ghost.vesselView");
  assert.equal(schema.schema.type, "string");

  assert.equal(registry.getSchemas().size, 2);
  assert.deepEqual(
    [...registry.getSchemasByOwner("ghost.vesselView").keys()],
    ["ghost.vesselView.theme", "ghost.vesselView.zoom"],
  );
});

test("preserves first owner deterministically for duplicate keys", () => {
  const registry = createSchemaRegistry();

  const first = registry.register({
    ownerId: "plugin-a",
    namespace: "ghost.vesselView",
    properties: {
      theme: { type: "string" },
    },
  });
  assert.equal(first.errors.length, 0);

  const second = registry.register({
    ownerId: "plugin-b",
    namespace: "ghost.vesselView",
    properties: {
      theme: { type: "number" },
    },
  });
  assert.equal(second.errors.length, 1);
  assert.equal(second.errors[0].type, "duplicate-key");
  assert.deepEqual(second.errors[0].ownerIds, ["plugin-a", "plugin-b"]);

  const composed = registry.getSchema("ghost.vesselView.theme");
  assert.equal(composed.ownerId, "plugin-a");
  assert.equal(composed.schema.type, "string");
});

test("rebinds key ownership when first owner unregisters", () => {
  const registry = createSchemaRegistry();

  registry.register({
    ownerId: "plugin-a",
    namespace: "ghost.vesselView",
    properties: {
      theme: { type: "string" },
    },
  });
  registry.register({
    ownerId: "plugin-b",
    namespace: "ghost.vesselView",
    properties: {
      theme: { type: "number" },
    },
  });

  const unregisterResult = registry.unregister("plugin-a");
  assert.deepEqual(unregisterResult.removedKeys, []);

  const composed = registry.getSchema("ghost.vesselView.theme");
  assert.ok(composed);
  assert.equal(composed.ownerId, "plugin-b");
  assert.equal(composed.schema.type, "number");
  assert.equal(registry.getCompositionErrors().length, 0);
});

test("unregister removes all keys using owner index", () => {
  const registry = createSchemaRegistry();

  registry.register({
    ownerId: "plugin-a",
    namespace: "ghost.multi",
    properties: {
      alpha: { type: "string" },
      beta: { type: "boolean" },
    },
  });

  const unregisterResult = registry.unregister("plugin-a");
  assert.deepEqual(unregisterResult.removedKeys, [
    "ghost.multi.alpha",
    "ghost.multi.beta",
  ]);
  assert.equal(registry.getSchemas().size, 0);
  assert.equal(registry.getSchemasByOwner("plugin-a").size, 0);
});
