import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defineViewConfig } from "../dist/index.js";

describe("defineViewConfig", () => {
  it("returns its input unchanged", () => {
    const declaration = {
      viewId: "TestView",
      schemas: [
        {
          type: /** @type {const} */ ("string"),
          description: "A test property",
        },
      ],
    };
    const result = defineViewConfig(declaration);
    assert.deepStrictEqual(result, declaration);
    assert.equal(result, declaration);
  });

  it("accepts declaration with all optional fields", () => {
    const declaration = {
      viewId: "FullView",
      description: "A fully-specified view config",
      category: "navigation",
      schemas: [
        {
          type: /** @type {const} */ ("number"),
          description: "Zoom level",
          minimum: 1,
          maximum: 20,
        },
        {
          type: /** @type {const} */ ("boolean"),
          description: "Show labels",
        },
      ],
    };
    const result = defineViewConfig(declaration);
    assert.equal(result.viewId, "FullView");
    assert.equal(result.description, "A fully-specified view config");
    assert.equal(result.category, "navigation");
    assert.equal(result.schemas.length, 2);
  });

  it("accepts declaration with minimal fields (viewId + schemas only)", () => {
    const declaration = {
      viewId: "MinimalView",
      schemas: [],
    };
    const result = defineViewConfig(declaration);
    assert.equal(result.viewId, "MinimalView");
    assert.deepStrictEqual(result.schemas, []);
    assert.equal(result.description, undefined);
    assert.equal(result.category, undefined);
  });
});
