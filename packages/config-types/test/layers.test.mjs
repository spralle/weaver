import { Layers, replaceOnly } from "../dist/index.js";

describe("Layers factories", () => {
  describe("Layers.Static", () => {
    it("returns a LayerDefinition with correct name and type.id", () => {
      const layer = Layers.Static("core");
      expect(layer.name).toBe("core");
      expect(layer.type.id).toBe("static");
      expect(layer.type.persistent).toBe(true);
      expect(layer.config).toStrictEqual({});
    });

    it("accepts optional config", () => {
      const merge = (_b, o) => o;
      const layer = Layers.Static("app", { merge });
      expect(layer.name).toBe("app");
      expect(layer.type.id).toBe("static");
      expect(layer.config).toStrictEqual({ merge });
    });
  });

  describe("Layers.Dynamic", () => {
    it("returns correct definition with config", () => {
      const scopes = [
        { id: "region", label: "Region" },
        { id: "office", label: "Office", parentScopeId: "region" },
      ];
      const layer = Layers.Dynamic("org", { scopes });
      expect(layer.name).toBe("org");
      expect(layer.type.id).toBe("dynamic");
      expect(layer.type.persistent).toBe(true);
      expect(layer.config).toStrictEqual({ scopes });
    });

    it("returns correct definition without config", () => {
      const layer = Layers.Dynamic("features");
      expect(layer.name).toBe("features");
      expect(layer.type.id).toBe("dynamic");
      expect(layer.config).toStrictEqual({});
    });
  });

  describe("Layers.Personal", () => {
    it("returns correct definition", () => {
      const layer = Layers.Personal("user");
      expect(layer.name).toBe("user");
      expect(layer.type.id).toBe("personal");
      expect(layer.type.persistent).toBe(true);
      expect(layer.config).toStrictEqual({});
    });
  });

  describe("Layers.Ephemeral", () => {
    it("returns correct definition with persistent=false", () => {
      const layer = Layers.Ephemeral("session");
      expect(layer.name).toBe("session");
      expect(layer.type.id).toBe("ephemeral");
      expect(layer.type.persistent).toBe(false);
      expect(layer.config).toStrictEqual({});
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

      expect(layer.name).toBe("cloud");
      expect(layer.type.id).toBe("remote");
      expect(layer.type.persistent).toBe(true);
      expect(layer.config).toStrictEqual({
        endpoint: "https://api.example.com",
      });

      const resolver = remoteType.createResolver(
        /** @type {any} */ ({}),
        layer.config,
      );
      expect(resolver.resolve({})).toStrictEqual([]);
    });
  });
});

describe("replaceOnly merge function", () => {
  it("returns override value regardless of base", () => {
    expect(replaceOnly("base", "override")).toBe("override");
    const obj = { b: 2 };
    expect(replaceOnly({ a: 1 }, obj)).toBe(obj);
    expect(replaceOnly({ a: 1 }, { b: 2 })).toStrictEqual({ b: 2 });
    expect(replaceOnly(42, null)).toBe(null);
    expect(replaceOnly("something", undefined)).toBe(undefined);
  });
});

describe("default merge function (via LayerType)", () => {
  // Access the default merge through any built-in layer type
  const defaultMerge = Layers.Static("test").type.defaultMerge;

  it("null clears value (returns undefined)", () => {
    expect(defaultMerge("anything", null)).toBe(undefined);
    expect(defaultMerge({ a: 1 }, null)).toBe(undefined);
  });

  it("undefined base returns override", () => {
    expect(defaultMerge(undefined, "value")).toBe("value");
    expect(defaultMerge(undefined, 42)).toBe(42);
  });

  it("undefined override returns base", () => {
    expect(defaultMerge("base", undefined)).toBe("base");
    expect(defaultMerge(42, undefined)).toBe(42);
  });

  it("deep merges plain objects", () => {
    const base = { a: 1, b: { c: 2, d: 3 } };
    const override = { b: { c: 99 }, e: 5 };
    const result = defaultMerge(base, override);
    expect(result).toStrictEqual({ a: 1, b: { c: 99, d: 3 }, e: 5 });
  });

  it("arrays replace (no deep merge on arrays)", () => {
    const base = { items: [1, 2, 3] };
    const override = { items: [4, 5] };
    const result = defaultMerge(base, override);
    expect(result).toStrictEqual({ items: [4, 5] });
  });

  it("scalar override replaces scalar base", () => {
    expect(defaultMerge(1, 2)).toBe(2);
    expect(defaultMerge("a", "b")).toBe("b");
    expect(defaultMerge(true, false)).toBe(false);
  });

  it("object override replaces scalar base", () => {
    expect(defaultMerge(42, { a: 1 })).toStrictEqual({ a: 1 });
  });

  it("scalar override replaces object base", () => {
    expect(defaultMerge({ a: 1 }, "string")).toBe("string");
  });
});
