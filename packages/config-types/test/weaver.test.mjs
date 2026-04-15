import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defineWeaver, Layers } from "../dist/index.js";

describe("defineWeaver", () => {
  it("returns WeaverConfig with correct layerNames", () => {
    const weaver = defineWeaver([
      Layers.Static("core"),
      Layers.Static("app"),
    ]);
    assert.deepStrictEqual([...weaver.layerNames], ["core", "app"]);
  });

  it("order = rank: first layer gets rank 0, second gets rank 1", () => {
    const weaver = defineWeaver([
      Layers.Static("core"),
      Layers.Static("app"),
      Layers.Personal("user"),
    ]);
    assert.equal(weaver.getRank("core"), 0);
    assert.equal(weaver.getRank("app"), 1);
    assert.equal(weaver.getRank("user"), 2);
  });

  it("getRank returns correct index", () => {
    const weaver = defineWeaver([
      Layers.Static("core"),
      Layers.Dynamic("features"),
      Layers.Ephemeral("session"),
    ]);
    assert.equal(weaver.getRank("core"), 0);
    assert.equal(weaver.getRank("features"), 1);
    assert.equal(weaver.getRank("session"), 2);
  });

  it("getRank returns -1 for nonexistent layer", () => {
    const weaver = defineWeaver([Layers.Static("core")]);
    assert.equal(weaver.getRank("nonexistent"), -1);
  });

  it("getLayer returns the correct definition", () => {
    const weaver = defineWeaver([
      Layers.Static("core"),
      Layers.Personal("user"),
    ]);
    const core = weaver.getLayer("core");
    assert.notEqual(core, undefined);
    assert.equal(core?.name, "core");
    assert.equal(core?.type.id, "static");
  });

  it("getLayer returns undefined for nonexistent layer", () => {
    const weaver = defineWeaver([Layers.Static("core")]);
    const result = weaver.getLayer(/** @type {any} */ ("nonexistent"));
    assert.equal(result, undefined);
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
    assert.equal(statics.length, 2);
    assert.equal(statics[0]?.name, "core");
    assert.equal(statics[1]?.name, "app");

    const dynamics = weaver.getLayersByType("dynamic");
    assert.equal(dynamics.length, 1);
    assert.equal(dynamics[0]?.name, "features");

    const personals = weaver.getLayersByType("personal");
    assert.equal(personals.length, 1);
    assert.equal(personals[0]?.name, "user");

    const ephemerals = weaver.getLayersByType("ephemeral");
    assert.equal(ephemerals.length, 1);
    assert.equal(ephemerals[0]?.name, "session");

    const nonexistent = weaver.getLayersByType("nonexistent");
    assert.equal(nonexistent.length, 0);
  });

  it("throws on duplicate layer names", () => {
    assert.throws(
      () =>
        defineWeaver([
          Layers.Static("core"),
          Layers.Static("core"),
        ]),
      { message: 'Duplicate layer name: "core"' },
    );
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
    assert.equal(weaver.layerNames.length, 10);

    // Correct ordering
    assert.equal(weaver.getRank("core"), 0);
    assert.equal(weaver.getRank("app"), 1);
    assert.equal(weaver.getRank("features"), 2);
    assert.equal(weaver.getRank("module"), 3);
    assert.equal(weaver.getRank("integrator"), 4);
    assert.equal(weaver.getRank("tenant"), 5);
    assert.equal(weaver.getRank("organizational"), 6);
    assert.equal(weaver.getRank("user"), 7);
    assert.equal(weaver.getRank("device"), 8);
    assert.equal(weaver.getRank("session"), 9);

    // Type-based queries
    assert.equal(weaver.getLayersByType("static").length, 5);
    assert.equal(weaver.getLayersByType("dynamic").length, 2);
    assert.equal(weaver.getLayersByType("personal").length, 2);
    assert.equal(weaver.getLayersByType("ephemeral").length, 1);

    // Layer retrieval
    const session = weaver.getLayer("session");
    assert.notEqual(session, undefined);
    assert.equal(session?.type.id, "ephemeral");
    assert.equal(session?.type.persistent, false);

    // rankMap is populated
    assert.equal(weaver.rankMap.size, 10);
  });

  it("preserves layers as readonly array", () => {
    const weaver = defineWeaver([
      Layers.Static("core"),
      Layers.Personal("user"),
    ]);
    assert.equal(weaver.layers.length, 2);
    assert.equal(weaver.layers[0]?.name, "core");
    assert.equal(weaver.layers[1]?.name, "user");
  });

  it("works with empty layer array", () => {
    const weaver = defineWeaver([]);
    assert.equal(weaver.layerNames.length, 0);
    assert.equal(weaver.rankMap.size, 0);
    assert.equal(weaver.getRank("anything"), -1);
    assert.equal(weaver.getLayer(/** @type {any} */ ("x")), undefined);
    assert.equal(weaver.getLayersByType("static").length, 0);
  });
});
