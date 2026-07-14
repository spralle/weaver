import { Layers, replaceOnly } from "../src/layer-factories.js";
import { defineWeaver } from "../src/weaver.js";

describe("Layers factories", () => {
  it("Static creates a persistent static layer", () => {
    const layer = Layers.Static("defaults");
    expect(layer.name).toBe("defaults");
    expect(layer.type.id).toBe("static");
    expect(layer.type.persistent).toBe(true);
  });

  it("Dynamic creates a persistent dynamic layer", () => {
    const layer = Layers.Dynamic("remote");
    expect(layer.name).toBe("remote");
    expect(layer.type.id).toBe("dynamic");
    expect(layer.type.persistent).toBe(true);
  });

  it("Personal creates a persistent personal layer", () => {
    const layer = Layers.Personal("user");
    expect(layer.name).toBe("user");
    expect(layer.type.id).toBe("personal");
  });

  it("Ephemeral creates a non-persistent layer", () => {
    const layer = Layers.Ephemeral("session");
    expect(layer.name).toBe("session");
    expect(layer.type.id).toBe("ephemeral");
    expect(layer.type.persistent).toBe(false);
  });
});

describe("defineWeaver", () => {
  it("creates a config with ranked layers", () => {
    const config = defineWeaver([
      Layers.Static("defaults"),
      Layers.Dynamic("remote"),
      Layers.Personal("user"),
    ] as const);

    expect([...config.layerNames]).toEqual(["defaults", "remote", "user"]);
    expect(config.getRank("defaults")).toBe(0);
    expect(config.getRank("remote")).toBe(1);
    expect(config.getRank("user")).toBe(2);
    expect(config.getRank("unknown")).toBe(-1);
  });

  it("throws on duplicate layer names", () => {
    expect(() =>
      defineWeaver([Layers.Static("x"), Layers.Static("x")] as const),
    ).toThrow(/Duplicate layer name/);
  });

  it("getLayer returns the definition by name", () => {
    const config = defineWeaver([
      Layers.Static("a"),
      Layers.Dynamic("b"),
    ] as const);
    const layer = config.getLayer("b");
    expect(layer?.type.id).toBe("dynamic");
  });

  it("getLayersByType filters correctly", () => {
    const config = defineWeaver([
      Layers.Static("s1"),
      Layers.Dynamic("d1"),
      Layers.Static("s2"),
    ] as const);
    const statics = config.getLayersByType("static");
    expect(statics.length).toBe(2);
  });
});

describe("replaceOnly merge", () => {
  it("returns override regardless of base", () => {
    expect(replaceOnly({ a: 1 }, { b: 2 })).toEqual({ b: 2 });
    expect(replaceOnly("old", "new")).toBe("new");
    expect(replaceOnly(42, null)).toBe(null);
  });
});
