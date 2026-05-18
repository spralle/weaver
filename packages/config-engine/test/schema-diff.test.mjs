import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectBreakingChanges,
  diffSchemaKeys,
  getSchemaProperties,
  getSchemaPropertyType,
  schemasEqual,
} from "@weaver/config-engine";

describe("schema-diff", () => {
  describe("getSchemaProperties", () => {
    it("extracts keys from flat object", () => {
      const props = getSchemaProperties({ foo: { type: "string" }, bar: { type: "number" } });
      assert.deepEqual(props, new Set(["foo", "bar"]));
    });

    it("extracts keys from properties wrapper", () => {
      const props = getSchemaProperties({ properties: { a: { type: "string" }, b: { type: "boolean" } } });
      assert.deepEqual(props, new Set(["a", "b"]));
    });

    it("returns empty set for empty object", () => {
      assert.deepEqual(getSchemaProperties({}), new Set());
    });
  });

  describe("getSchemaPropertyType", () => {
    it("reads type from properties wrapper", () => {
      const schema = { properties: { name: { type: "string" } } };
      assert.equal(getSchemaPropertyType(schema, "name"), "string");
    });

    it("reads type from properties-wrapped schema", () => {
      const schema = { type: "object", properties: { name: { type: "string" } } };
      assert.equal(getSchemaPropertyType(schema, "name"), "string");
    });

    it("returns undefined for missing property", () => {
      assert.equal(getSchemaPropertyType({ properties: { a: { type: "string" } } }, "b"), undefined);
    });
  });

  describe("schemasEqual", () => {
    it("returns true for identical schemas", () => {
      assert.equal(schemasEqual({ a: 1 }, { a: 1 }), true);
    });

    it("returns false for different schemas", () => {
      assert.equal(schemasEqual({ a: 1 }, { a: 2 }), false);
    });

    it("is order-sensitive (JSON serialization)", () => {
      assert.equal(schemasEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), false);
    });
  });

  describe("detectBreakingChanges", () => {
    it("detects removed properties", () => {
      const existing = { properties: { name: { type: "string" }, age: { type: "number" } } };
      const incoming = { properties: { name: { type: "string" } } };
      const changes = detectBreakingChanges(existing, incoming);
      assert.equal(changes.length, 1);
      assert.equal(changes[0].type, "removed-property");
      assert.equal(changes[0].property, "age");
    });

    it("detects type changes", () => {
      const existing = { properties: { name: { type: "string" } } };
      const incoming = { properties: { name: { type: "number" } } };
      const changes = detectBreakingChanges(existing, incoming);
      assert.equal(changes.length, 1);
      assert.equal(changes[0].type, "type-changed");
      assert.equal(changes[0].property, "name");
    });

    it("returns empty array for compatible changes (added properties)", () => {
      const existing = { properties: { name: { type: "string" } } };
      const incoming = { properties: { name: { type: "string" }, age: { type: "number" } } };
      const changes = detectBreakingChanges(existing, incoming);
      assert.equal(changes.length, 0);
    });

    it("returns empty for identical schemas", () => {
      const schema = { properties: { x: { type: "boolean" } } };
      assert.deepEqual(detectBreakingChanges(schema, schema), []);
    });
  });

  describe("diffSchemaKeys", () => {
    it("detects added and removed keys", () => {
      const existing = { properties: { a: { type: "string" }, b: { type: "string" } } };
      const incoming = { properties: { b: { type: "string" }, c: { type: "string" } } };
      const { added, removed } = diffSchemaKeys(existing, incoming);
      assert.deepEqual(added, new Set(["c"]));
      assert.deepEqual(removed, new Set(["a"]));
    });

    it("returns empty sets for identical schemas", () => {
      const schema = { properties: { x: { type: "number" } } };
      const { added, removed } = diffSchemaKeys(schema, schema);
      assert.equal(added.size, 0);
      assert.equal(removed.size, 0);
    });
  });
});
