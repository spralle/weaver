import { defineViewConfig } from "../src";

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
    expect(result).toStrictEqual(declaration);
    expect(result).toBe(declaration);
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
    expect(result.viewId).toBe("FullView");
    expect(result.description).toBe("A fully-specified view config");
    expect(result.category).toBe("navigation");
    expect(result.schemas.length).toBe(2);
  });

  it("accepts declaration with minimal fields (viewId + schemas only)", () => {
    const declaration = {
      viewId: "MinimalView",
      schemas: [],
    };
    const result = defineViewConfig(declaration);
    expect(result.viewId).toBe("MinimalView");
    expect(result.schemas).toStrictEqual([]);
    expect(result.description).toBe(undefined);
    expect(result.category).toBe(undefined);
  });
});
