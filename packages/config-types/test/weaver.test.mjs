import { defineWeaver, Layers } from "../dist/index.js";

describe("defineWeaver", () => {
  it("returns WeaverConfig with correct layerNames", () => {
    const weaver = defineWeaver([
      Layers.Static("core"),
      Layers.Static("app"),
    ]);
    expect([...weaver.layerNames]).toStrictEqual(["core", "app"]);
  });

  it("order = rank: first layer gets rank 0, second gets rank 1", () => {
    const weaver = defineWeaver([
      Layers.Static("core"),
      Layers.Static("app"),
      Layers.Personal("user"),
    ]);
    expect(weaver.getRank("core")).toBe(0);
    expect(weaver.getRank("app")).toBe(1);
    expect(weaver.getRank("user")).toBe(2);
  });

  it("getRank returns correct index", () => {
    const weaver = defineWeaver([
      Layers.Static("core"),
      Layers.Dynamic("features"),
      Layers.Ephemeral("session"),
    ]);
    expect(weaver.getRank("core")).toBe(0);
    expect(weaver.getRank("features")).toBe(1);
    expect(weaver.getRank("session")).toBe(2);
  });

  it("getRank returns -1 for nonexistent layer", () => {
    const weaver = defineWeaver([Layers.Static("core")]);
    expect(weaver.getRank("nonexistent")).toBe(-1);
  });

  it("getLayer returns the correct definition", () => {
    const weaver = defineWeaver([
      Layers.Static("core"),
      Layers.Personal("user"),
    ]);
    const core = weaver.getLayer("core");
    expect(core).not.toBe(undefined);
    expect(core?.name).toBe("core");
    expect(core?.type.id).toBe("static");
  });

  it("getLayer returns undefined for nonexistent layer", () => {
    const weaver = defineWeaver([Layers.Static("core")]);
    const result = weaver.getLayer(/** @type {any} */ ("nonexistent"));
    expect(result).toBe(undefined);
  });

  it("getLayersByType returns only layers of that type", () => {
    const weaver = defineWeaver([
      Layers.Static("core"),
      Layers.Static("app"),
      Layers.Dynamic("features"),
      Layers.Personal("user"),
      Layers.Ephemeral("session"),
    ]);

    const statics = weaver.getLayersByType("static");
    expect(statics.length).toBe(2);
    expect(statics[0]?.name).toBe("core");
    expect(statics[1]?.name).toBe("app");

    const dynamics = weaver.getLayersByType("dynamic");
    expect(dynamics.length).toBe(1);
    expect(dynamics[0]?.name).toBe("features");

    const personals = weaver.getLayersByType("personal");
    expect(personals.length).toBe(1);
    expect(personals[0]?.name).toBe("user");

    const ephemerals = weaver.getLayersByType("ephemeral");
    expect(ephemerals.length).toBe(1);
    expect(ephemerals[0]?.name).toBe("session");

    const nonexistent = weaver.getLayersByType("nonexistent");
    expect(nonexistent.length).toBe(0);
  });

  it("throws on duplicate layer names", () => {
    expect(() =>
      defineWeaver([
        Layers.Static("core"),
        Layers.Static("core"),
      ])).toThrow('Duplicate layer name: "core"');
  });

  it("works with the full Armada-style layer stack", () => {
    const weaver = defineWeaver([
      Layers.Static("core"),
      Layers.Static("app"),
      Layers.Dynamic("features"),
      Layers.Static("module"),
      Layers.Static("integrator"),
      Layers.Static("tenant"),
      Layers.Dynamic("organizational"),
      Layers.Personal("user"),
      Layers.Personal("device"),
      Layers.Ephemeral("session"),
    ]);

    // All 10 layers present
    expect(weaver.layerNames.length).toBe(10);

    // Correct ordering
    expect(weaver.getRank("core")).toBe(0);
    expect(weaver.getRank("app")).toBe(1);
    expect(weaver.getRank("features")).toBe(2);
    expect(weaver.getRank("module")).toBe(3);
    expect(weaver.getRank("integrator")).toBe(4);
    expect(weaver.getRank("tenant")).toBe(5);
    expect(weaver.getRank("organizational")).toBe(6);
    expect(weaver.getRank("user")).toBe(7);
    expect(weaver.getRank("device")).toBe(8);
    expect(weaver.getRank("session")).toBe(9);

    // Type-based queries
    expect(weaver.getLayersByType("static").length).toBe(5);
    expect(weaver.getLayersByType("dynamic").length).toBe(2);
    expect(weaver.getLayersByType("personal").length).toBe(2);
    expect(weaver.getLayersByType("ephemeral").length).toBe(1);

    // Layer retrieval
    const session = weaver.getLayer("session");
    expect(session).not.toBe(undefined);
    expect(session?.type.id).toBe("ephemeral");
    expect(session?.type.persistent).toBe(false);

    // rankMap is populated
    expect(weaver.rankMap.size).toBe(10);
  });

  it("preserves layers as readonly array", () => {
    const weaver = defineWeaver([
      Layers.Static("core"),
      Layers.Personal("user"),
    ]);
    expect(weaver.layers.length).toBe(2);
    expect(weaver.layers[0]?.name).toBe("core");
    expect(weaver.layers[1]?.name).toBe("user");
  });

  it("works with empty layer array", () => {
    const weaver = defineWeaver([]);
    expect(weaver.layerNames.length).toBe(0);
    expect(weaver.rankMap.size).toBe(0);
    expect(weaver.getRank("anything")).toBe(-1);
    expect(weaver.getLayer(/** @type {any} */ ("x"))).toBe(undefined);
    expect(weaver.getLayersByType("static").length).toBe(0);
  });
});
