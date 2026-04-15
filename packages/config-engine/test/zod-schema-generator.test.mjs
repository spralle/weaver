import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateZodSchemaSource,
  generateZodForProperty,
  sanitizeKeyToIdentifier,
} from "../dist/index.js";

/** @param {object} schema */
function entry(ownerId, schema) {
  return { ownerId, fullyQualifiedKey: "test.key", schema };
}

describe("sanitizeKeyToIdentifier", () => {
  it("converts dots to underscores", () => {
    assert.equal(sanitizeKeyToIdentifier("ghost.shell.theme"), "ghost_shell_theme");
  });

  it("converts hyphens to underscores", () => {
    assert.equal(sanitizeKeyToIdentifier("ghost.vessel-view.zoom"), "ghost_vessel_view_zoom");
  });

  it("converts dots and hyphens together", () => {
    assert.equal(
      sanitizeKeyToIdentifier("ghost.my-plugin.setting"),
      "ghost_my_plugin_setting",
    );
  });
});

describe("generateZodForProperty", () => {
  it("generates z.string() for string type", () => {
    const result = generateZodForProperty(
      "ghost.shell.theme",
      entry("ghost.shell", { type: "string" }),
    );
    assert.equal(result, "z.string()");
  });

  it("generates z.number() with min/max for number type", () => {
    const result = generateZodForProperty(
      "ghost.map.zoom",
      entry("ghost.map", { type: "number", minimum: 1, maximum: 20 }),
    );
    assert.equal(result, "z.number().min(1).max(20)");
  });

  it("generates z.boolean() for boolean type", () => {
    const result = generateZodForProperty(
      "ghost.shell.enabled",
      entry("ghost.shell", { type: "boolean" }),
    );
    assert.equal(result, "z.boolean()");
  });

  it("generates z.record for object type", () => {
    const result = generateZodForProperty(
      "ghost.shell.layout",
      entry("ghost.shell", { type: "object" }),
    );
    assert.equal(result, "z.record(z.string(), z.unknown())");
  });

  it("generates z.array for array type", () => {
    const result = generateZodForProperty(
      "ghost.shell.plugins",
      entry("ghost.shell", { type: "array" }),
    );
    assert.equal(result, "z.array(z.unknown())");
  });

  it("generates nested object/array schemas", () => {
    const result = generateZodForProperty(
      "ghost.shell.layout",
      entry("ghost.shell", {
        type: "object",
        properties: {
          panels: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
              },
            },
          },
        },
      }),
    );
    assert.equal(result, 'z.object({ "panels": z.array(z.object({ "id": z.string() })) })');
  });

  it("generates integer as z.number().int()", () => {
    const result = generateZodForProperty(
      "ghost.map.grid",
      entry("ghost.map", { type: "integer", minimum: 1, maximum: 9 }),
    );
    assert.equal(result, "z.number().int().min(1).max(9)");
  });

  it("uses first type for union type arrays in zod generation", () => {
    const result = generateZodForProperty(
      "ghost.map.optionalGrid",
      entry("ghost.map", { type: ["integer", "null"], default: 3 }),
    );
    assert.equal(result, "z.number().int().default(3)");
  });

  it("generates z.enum([...]) for string with enum", () => {
    const result = generateZodForProperty(
      "ghost.shell.theme",
      entry("ghost.shell", { type: "string", enum: ["dark", "light"] }),
    );
    assert.equal(result, 'z.enum(["dark", "light"])');
  });

  it("chains .default() for default values", () => {
    const result = generateZodForProperty(
      "ghost.shell.theme",
      entry("ghost.shell", { type: "string", default: "dark" }),
    );
    assert.equal(result, 'z.string().default("dark")');
  });

  it("chains min, max, and default for number type", () => {
    const result = generateZodForProperty(
      "ghost.map.zoom",
      entry("ghost.map", { type: "number", minimum: 1, maximum: 20, default: 5 }),
    );
    assert.equal(result, "z.number().min(1).max(20).default(5)");
  });
});

describe("generateZodSchemaSource", () => {
  it("produces valid header with import", () => {
    const schemas = new Map();
    schemas.set("ghost.shell.theme", {
      ownerId: "ghost.shell",
      fullyQualifiedKey: "ghost.shell.theme",
      schema: { type: "string", default: "dark" },
    });

    const source = generateZodSchemaSource(schemas);
    assert.ok(source.startsWith('import { z } from "zod";'));
  });

  it("produces configSchemas record", () => {
    const schemas = new Map();
    schemas.set("ghost.shell.theme", {
      ownerId: "ghost.shell",
      fullyQualifiedKey: "ghost.shell.theme",
      schema: { type: "string", default: "dark" },
    });
    schemas.set("ghost.map.zoom", {
      ownerId: "ghost.map",
      fullyQualifiedKey: "ghost.map.zoom",
      schema: { type: "number", minimum: 1, maximum: 20 },
    });

    const source = generateZodSchemaSource(schemas);
    assert.ok(source.includes("export const configSchemas = {"));
    assert.ok(source.includes('"ghost.shell.theme": ghost_shell_theme,'));
    assert.ok(source.includes('"ghost.map.zoom": ghost_map_zoom,'));
    assert.ok(source.includes("} as const;"));
  });

  it("produces individual exports with correct identifiers", () => {
    const schemas = new Map();
    schemas.set("ghost.shell.theme", {
      ownerId: "ghost.shell",
      fullyQualifiedKey: "ghost.shell.theme",
      schema: { type: "string", default: "dark" },
    });

    const source = generateZodSchemaSource(schemas);
    assert.ok(
      source.includes('export const ghost_shell_theme = z.string().default("dark");'),
    );
  });

  it("handles empty schemas map", () => {
    const source = generateZodSchemaSource(new Map());
    assert.ok(source.includes('import { z } from "zod";'));
    assert.ok(source.includes("export const configSchemas = {"));
    assert.ok(source.includes("} as const;"));
  });
});
