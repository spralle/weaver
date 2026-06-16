import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { defineNamespace } from "../src/namespace.js";
import {
  registerNamespaces,
  zodShapeToJsonSchema,
} from "../src/registration.js";
import type { WeaverTransport } from "../src/transport.js";

describe("zodShapeToJsonSchema", () => {
  it("converts basic string/number/boolean types", () => {
    const shape = {
      name: z.string(),
      age: z.number(),
      active: z.boolean(),
    };
    const result = zodShapeToJsonSchema(shape);
    assert.deepEqual(result.properties, {
      name: { type: "string" },
      age: { type: "number" },
      active: { type: "boolean" },
    });
    assert.deepEqual(result.required, ["name", "age", "active"]);
  });

  it("handles optional fields", () => {
    const shape = {
      name: z.string(),
      nickname: z.optional(z.string()),
    };
    const result = zodShapeToJsonSchema(shape);
    assert.deepEqual(result.required, ["name"]);
  });

  it("handles array type", () => {
    const shape = { tags: z.array(z.string()) };
    const result = zodShapeToJsonSchema(shape);
    const props = result.properties as Record<string, Record<string, unknown>>;
    assert.equal(props.tags.type, "array");
  });

  it("handles enum type", () => {
    const shape = { level: z.enum(["low", "medium", "high"]) };
    const result = zodShapeToJsonSchema(shape);
    const props = result.properties as Record<string, Record<string, unknown>>;
    assert.equal(props.level.type, "string");
    assert.deepEqual(props.level.enum, ["low", "medium", "high"]);
  });
});

describe("registerNamespaces", () => {
  it("calls transport.registerSchema for each definition", async () => {
    const registered: Array<{ ns: string; schema: Record<string, unknown> }> =
      [];
    const transport = {
      registerSchema: async (ns: string, schema: Record<string, unknown>) => {
        registered.push({ ns, schema });
      },
    } as unknown as WeaverTransport;

    const defs = [
      defineNamespace("editor", { fontSize: z.number() }),
      defineNamespace("theme", { name: z.string() }),
    ];

    const result = await registerNamespaces(defs, transport);
    assert.deepEqual(result.registered, ["editor", "theme"]);
    assert.equal(result.skipped.length, 0);
    assert.equal(result.errors.length, 0);
    assert.equal(registered.length, 2);
  });

  it("gracefully handles transport without registerSchema", async () => {
    const transport = {} as unknown as WeaverTransport;
    const defs = [defineNamespace("editor", { fontSize: z.number() })];

    const result = await registerNamespaces(defs, transport);
    assert.deepEqual(result.skipped, ["editor"]);
    assert.equal(result.registered.length, 0);
  });

  it("reports errors per-namespace without aborting", async () => {
    let callCount = 0;
    const transport = {
      registerSchema: async (ns: string) => {
        callCount++;
        if (ns === "bad") throw new Error("Server rejected");
      },
    } as unknown as WeaverTransport;

    const defs = [
      defineNamespace("good", { x: z.string() }),
      defineNamespace("bad", { y: z.number() }),
      defineNamespace("also-good", { z: z.boolean() }),
    ];

    const result = await registerNamespaces(defs, transport);
    assert.deepEqual(result.registered, ["good", "also-good"]);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].namespace, "bad");
    assert.equal(callCount, 3);
  });
});
