import {
  detectBreakingChanges,
  diffSchemaKeys,
  getSchemaProperties,
  getSchemaPropertyType,
  schemasEqual,
} from "@weaver-conf/config-engine";

describe("schema-diff", () => {
  describe("getSchemaProperties", () => {
    it("extracts keys from flat object", () => {
      const props = getSchemaProperties({ foo: { type: "string" }, bar: { type: "number" } });
      expect(props).toEqual(new Set(["foo", "bar"]));
    });

    it("extracts keys from properties wrapper", () => {
      const props = getSchemaProperties({ properties: { a: { type: "string" }, b: { type: "boolean" } } });
      expect(props).toEqual(new Set(["a", "b"]));
    });

    it("returns empty set for empty object", () => {
      expect(getSchemaProperties({})).toEqual(new Set());
    });
  });

  describe("getSchemaPropertyType", () => {
    it("reads type from properties wrapper", () => {
      const schema = { properties: { name: { type: "string" } } };
      expect(getSchemaPropertyType(schema, "name")).toBe("string");
    });

    it("reads type from properties-wrapped schema", () => {
      const schema = { type: "object", properties: { name: { type: "string" } } };
      expect(getSchemaPropertyType(schema, "name")).toBe("string");
    });

    it("returns undefined for missing property", () => {
      expect(getSchemaPropertyType({ properties: { a: { type: "string" } } }, "b")).toBe(undefined);
    });
  });

  describe("schemasEqual", () => {
    it("returns true for identical schemas", () => {
      expect(schemasEqual({ a: 1 }, { a: 1 })).toBe(true);
    });

    it("returns false for different schemas", () => {
      expect(schemasEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it("is order-insensitive (structural equality)", () => {
      expect(schemasEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    });
  });

  describe("detectBreakingChanges", () => {
    it("detects removed properties", () => {
      const existing = { properties: { name: { type: "string" }, age: { type: "number" } } };
      const incoming = { properties: { name: { type: "string" } } };
      const changes = detectBreakingChanges(existing, incoming);
      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe("removed-property");
      expect(changes[0].property).toBe("age");
    });

    it("detects type changes", () => {
      const existing = { properties: { name: { type: "string" } } };
      const incoming = { properties: { name: { type: "number" } } };
      const changes = detectBreakingChanges(existing, incoming);
      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe("type-changed");
      expect(changes[0].property).toBe("name");
    });

    it("returns empty array for compatible changes (added properties)", () => {
      const existing = { properties: { name: { type: "string" } } };
      const incoming = { properties: { name: { type: "string" }, age: { type: "number" } } };
      const changes = detectBreakingChanges(existing, incoming);
      expect(changes.length).toBe(0);
    });

    it("returns empty for identical schemas", () => {
      const schema = { properties: { x: { type: "boolean" } } };
      expect(detectBreakingChanges(schema, schema)).toEqual([]);
    });
  });

  describe("diffSchemaKeys", () => {
    it("detects added and removed keys", () => {
      const existing = { properties: { a: { type: "string" }, b: { type: "string" } } };
      const incoming = { properties: { b: { type: "string" }, c: { type: "string" } } };
      const { added, removed } = diffSchemaKeys(existing, incoming);
      expect(added).toEqual(new Set(["c"]));
      expect(removed).toEqual(new Set(["a"]));
    });

    it("returns empty sets for identical schemas", () => {
      const schema = { properties: { x: { type: "number" } } };
      const { added, removed } = diffSchemaKeys(schema, schema);
      expect(added.size).toBe(0);
      expect(removed.size).toBe(0);
    });
  });
});
