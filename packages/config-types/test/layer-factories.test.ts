import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Layers, replaceOnly } from "../src/layer-factories.js";
import { defineWeaver } from "../src/weaver.js";

describe("Layers factories", () => {
  it("Static creates a persistent static layer", () => {
    const layer = Layers.Static("defaults");
    assert.equal(layer.name, "defaults");
    assert.equal(layer.type.id, "static");
    assert.equal(layer.type.persistent, true);
  });

  it("Dynamic creates a persistent dynamic layer", () => {
    const layer = Layers.Dynamic("remote");
    assert.equal(layer.name, "remote");
    assert.equal(layer.type.id, "dynamic");
    assert.equal(layer.type.persistent, true);
  });

  it("Personal creates a persistent personal layer", () => {
    const layer = Layers.Personal("user");
    assert.equal(layer.name, "user");
    assert.equal(layer.type.id, "personal");
  });

  it("Ephemeral creates a non-persistent layer", () => {
    const layer = Layers.Ephemeral("session");
    assert.equal(layer.name, "session");
    assert.equal(layer.type.id, "ephemeral");
    assert.equal(layer.type.persistent, false);
  });
});

describe("defineWeaver", () => {
  it("creates a config with ranked layers", () => {
    const config = defineWeaver([
      Layers.Static("defaults"),
      Layers.Dynamic("remote"),
      Layers.Personal("user"),
    ] as const);

    assert.deepEqual([...config.layerNames], ["defaults", "remote", "user"]);
    assert.equal(config.getRank("defaults"), 0);
    assert.equal(config.getRank("remote"), 1);
    assert.equal(config.getRank("user"), 2);
    assert.equal(config.getRank("unknown"), -1);
  });

  it("throws on duplicate layer names", () => {
    assert.throws(
      () => defineWeaver([Layers.Static("x"), Layers.Static("x")] as const),
      /Duplicate layer name/,
    );
  });

  it("getLayer returns the definition by name", () => {
    const config = defineWeaver([Layers.Static("a"), Layers.Dynamic("b")] as const);
    const layer = config.getLayer("b");
    assert.equal(layer?.type.id, "dynamic");
  });

  it("getLayersByType filters correctly", () => {
    const config = defineWeaver([
      Layers.Static("s1"),
      Layers.Dynamic("d1"),
      Layers.Static("s2"),
    ] as const);
    const statics = config.getLayersByType("static");
    assert.equal(statics.length, 2);
  });
});

describe("replaceOnly merge", () => {
  it("returns override regardless of base", () => {
    assert.deepEqual(replaceOnly({ a: 1 }, { b: 2 }), { b: 2 });
    assert.equal(replaceOnly("old", "new"), "new");
    assert.equal(replaceOnly(42, null), null);
  });
});
