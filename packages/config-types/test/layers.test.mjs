import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Layers, replaceOnly } from "../dist/index.js";

describe("Layers factories", () => {
  describe("Layers.Static", () => {
    it("returns a LayerDefinition with correct name and type.id", () => {
      const layer = Layers.Static("core");
      assert.equal(layer.name, "core");
      assert.equal(layer.type.id, "static");
      assert.equal(layer.type.persistent, true);
      assert.deepStrictEqual(layer.config, {});
    });

    it("accepts optional config", () => {
      const merge = (_b, o) => o;
      const layer = Layers.Static("app", { merge });
      assert.equal(layer.name, "app");
      assert.equal(layer.type.id, "static");
      assert.deepStrictEqual(layer.config, { merge });
    });
  });

  describe("Layers.Dynamic", () => {
    it("returns correct definition with config", () => {
      const scopes = [
        { id: "region", label: "Region" },
        { id: "office", label: "Office", parentScopeId: "region" },
      ];
      const layer = Layers.Dynamic("org", { scopes });
      assert.equal(layer.name, "org");
      assert.equal(layer.type.id, "dynamic");
      assert.equal(layer.type.persistent, true);
      assert.deepStrictEqual(layer.config, { scopes });
    });

    it("returns correct definition without config", () => {
      const layer = Layers.Dynamic("features");
      assert.equal(layer.name, "features");
      assert.equal(layer.type.id, "dynamic");
      assert.deepStrictEqual(layer.config, {});
    });
  });

  describe("Layers.Personal", () => {
    it("returns correct definition", () => {
      const layer = Layers.Personal("user");
      assert.equal(layer.name, "user");
      assert.equal(layer.type.id, "personal");
      assert.equal(layer.type.persistent, true);
      assert.deepStrictEqual(layer.config, {});
    });
  });

  describe("Layers.Ephemeral", () => {
    it("returns correct definition with persistent=false", () => {
      const layer = Layers.Ephemeral("session");
      assert.equal(layer.name, "session");
      assert.equal(layer.type.id, "ephemeral");
      assert.equal(layer.type.persistent, false);
      assert.deepStrictEqual(layer.config, {});
    });
  });

  describe("Custom LayerType", () => {
    it("can be created and used as a factory", () => {
      /** @type {import("../dist/index.js").LayerType} */
      const remoteType = {
        id: "remote",
        persistent: true,
        defaultMerge: (_base, override) => override,
        createResolver(_provider, _config) {
          return { resolve: () => [] };
        },
      };

      /** @type {import("../dist/index.js").LayerDefinition} */
      const layer = {
        name: "cloud",
        type: remoteType,
        config: { endpoint: "https://api.example.com" },
      };

      assert.equal(layer.name, "cloud");
      assert.equal(layer.type.id, "remote");
      assert.equal(layer.type.persistent, true);
      assert.deepStrictEqual(layer.config, {
        endpoint: "https://api.example.com",
      });

      const resolver = remoteType.createResolver(
        /** @type {any} */ ({}),
        layer.config,
      );
      assert.deepStrictEqual(resolver.resolve({}), []);
    });
  });
});

describe("replaceOnly merge function", () => {
  it("returns override value regardless of base", () => {
    assert.equal(replaceOnly("base", "override"), "override");
    const obj = { b: 2 };
    assert.equal(replaceOnly({ a: 1 }, obj), obj);
    assert.deepStrictEqual(replaceOnly({ a: 1 }, { b: 2 }), { b: 2 });
    assert.equal(replaceOnly(42, null), null);
    assert.equal(replaceOnly("something", undefined), undefined);
  });
});

describe("default merge function (via LayerType)", () => {
  // Access the default merge through any built-in layer type
  const defaultMerge = Layers.Static("test").type.defaultMerge;

  it("null clears value (returns undefined)", () => {
    assert.equal(defaultMerge("anything", null), undefined);
    assert.equal(defaultMerge({ a: 1 }, null), undefined);
  });

  it("undefined base returns override", () => {
    assert.equal(defaultMerge(undefined, "value"), "value");
    assert.equal(defaultMerge(undefined, 42), 42);
  });

  it("undefined override returns base", () => {
    assert.equal(defaultMerge("base", undefined), "base");
    assert.equal(defaultMerge(42, undefined), 42);
  });

  it("deep merges plain objects", () => {
    const base = { a: 1, b: { c: 2, d: 3 } };
    const override = { b: { c: 99 }, e: 5 };
    const result = defaultMerge(base, override);
    assert.deepStrictEqual(result, { a: 1, b: { c: 99, d: 3 }, e: 5 });
  });

  it("arrays replace (no deep merge on arrays)", () => {
    const base = { items: [1, 2, 3] };
    const override = { items: [4, 5] };
    const result = defaultMerge(base, override);
    assert.deepStrictEqual(result, { items: [4, 5] });
  });

  it("scalar override replaces scalar base", () => {
    assert.equal(defaultMerge(1, 2), 2);
    assert.equal(defaultMerge("a", "b"), "b");
    assert.equal(defaultMerge(true, false), false);
  });

  it("object override replaces scalar base", () => {
    assert.deepStrictEqual(defaultMerge(42, { a: 1 }), { a: 1 });
  });

  it("scalar override replaces object base", () => {
    assert.equal(defaultMerge({ a: 1 }, "string"), "string");
  });
});
