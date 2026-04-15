import test from "node:test";
import assert from "node:assert/strict";

import { configurationPropertySchemaSchema } from "../src/schemas-core.ts";

test("configurationPropertySchemaSchema accepts recursive nested JSON schema", () => {
  const schema = {
    type: "object",
    required: ["panels"],
    properties: {
      panels: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["id", "order"],
          properties: {
            id: { type: "string", minLength: 1 },
            order: { type: "integer", minimum: 0 },
            metadata: {
              type: ["object", "null"],
              additionalProperties: { type: "string" },
            },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
    changePolicy: "full-pipeline",
    visibility: "admin",
    reloadBehavior: "hot",
  };

  const result = configurationPropertySchemaSchema.safeParse(schema);
  assert.equal(result.success, true);
});

test("configurationPropertySchemaSchema preserves backwards compatibility", () => {
  const schema = {
    type: "string",
    default: "dark",
    enum: ["dark", "light"],
    description: "Theme",
  };

  const result = configurationPropertySchemaSchema.safeParse(schema);
  assert.equal(result.success, true);
});

test("configurationPropertySchemaSchema rejects unsupported $ref and $defs", () => {
  const withRef = configurationPropertySchemaSchema.safeParse({
    type: "object",
    $ref: "#/something",
  });
  assert.equal(withRef.success, false);

  const withDefs = configurationPropertySchemaSchema.safeParse({
    type: "object",
    $defs: {},
  });
  assert.equal(withDefs.success, false);
});
