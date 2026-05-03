import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMountMap,
  resolveMountedValue,
  resolveMountedNamespace,
} from "../dist/index.js";

describe("buildMountMap", () => {
  it("returns empty map for empty entries", () => {
    const map = buildMountMap({});
    assert.equal(map.size, 0);
  });

  it("returns empty map when no mounts exist", () => {
    const map = buildMountMap({ a: "hello", b: 42 });
    assert.equal(map.size, 0);
  });

  it("detects a single mount", () => {
    const map = buildMountMap({
      "app.alias": { _weaver: "mount", source: "app.real" },
    });
    assert.equal(map.size, 1);
    assert.equal(map.get("app.alias"), "app.real");
  });

  it("detects multiple mounts", () => {
    const map = buildMountMap({
      a: { _weaver: "mount", source: "b" },
      c: { _weaver: "mount", source: "d" },
      e: "plain",
    });
    assert.equal(map.size, 2);
  });

  it("ignores SecretReference markers", () => {
    const map = buildMountMap({
      s: { _weaver: "secret", provider: "vault", ref: "x" },
    });
    assert.equal(map.size, 0);
  });
});

describe("resolveMountedValue", () => {
  it("returns direct value when key is not mounted", () => {
    const mountMap = new Map();
    const result = resolveMountedValue("k", mountMap, () => "val");
    assert.equal(result.value, "val");
    assert.deepEqual(result.chain, ["k"]);
    assert.equal(result.isMounted, false);
  });

  it("resolves single mount", () => {
    const mountMap = new Map([["a", "b"]]);
    const values = { a: { _weaver: "mount", source: "b" }, b: "real" };
    const result = resolveMountedValue("a", mountMap, (k) => values[k]);
    assert.equal(result.value, "real");
    assert.deepEqual(result.chain, ["a", "b"]);
    assert.equal(result.isMounted, true);
  });

  it("resolves chained mount A→B→C", () => {
    const mountMap = new Map([["a", "b"], ["b", "c"]]);
    const values = { c: "final" };
    const result = resolveMountedValue("a", mountMap, (k) => values[k]);
    assert.equal(result.value, "final");
    assert.deepEqual(result.chain, ["a", "b", "c"]);
    assert.equal(result.isMounted, true);
  });

  it("returns undefined for mount to non-existent key", () => {
    const mountMap = new Map([["a", "b"]]);
    const result = resolveMountedValue("a", mountMap, () => undefined);
    assert.equal(result.value, undefined);
    assert.deepEqual(result.chain, ["a", "b"]);
  });

  it("throws on cycle A→B→A", () => {
    const mountMap = new Map([["a", "b"], ["b", "a"]]);
    assert.throws(
      () => resolveMountedValue("a", mountMap, () => undefined),
      /Mount cycle detected/,
    );
  });

  it("throws on self-cycle A→A", () => {
    const mountMap = new Map([["a", "a"]]);
    assert.throws(
      () => resolveMountedValue("a", mountMap, () => undefined),
      /Mount cycle detected/,
    );
  });

  it("throws when max depth exceeded", () => {
    const mountMap = new Map([["a", "b"], ["b", "c"], ["c", "d"]]);
    assert.throws(
      () => resolveMountedValue("a", mountMap, () => undefined, 2),
      /exceeded maximum depth/,
    );
  });

  it("works at exactly max depth", () => {
    const mountMap = new Map([["a", "b"], ["b", "c"]]);
    const values = { c: "ok" };
    const result = resolveMountedValue("a", mountMap, (k) => values[k], 3);
    assert.equal(result.value, "ok");
  });
});

describe("resolveMountedNamespace", () => {
  it("returns raw values when no mounts", () => {
    const mountMap = new Map();
    const result = resolveMountedNamespace(
      "app",
      mountMap,
      () => ({ "app.x": 1, "app.y": 2 }),
      () => undefined,
    );
    assert.deepEqual(result, { "app.x": 1, "app.y": 2 });
  });

  it("resolves mounts in namespace", () => {
    const mountMap = new Map([["app.alias", "app.real"]]);
    const ns = { "app.alias": { _weaver: "mount", source: "app.real" }, "app.other": 5 };
    const values = { "app.real": "resolved", "app.alias": ns["app.alias"] };
    const result = resolveMountedNamespace(
      "app",
      mountMap,
      () => ns,
      (k) => values[k],
    );
    assert.equal(result["app.alias"], "resolved");
    assert.equal(result["app.other"], 5);
  });

  it("returns raw mount marker on error", () => {
    const mountMap = new Map([["app.a", "app.b"], ["app.b", "app.a"]]);
    const marker = { _weaver: "mount", source: "app.b" };
    const ns = { "app.a": marker };
    const result = resolveMountedNamespace(
      "app",
      mountMap,
      () => ns,
      () => undefined,
    );
    assert.deepEqual(result["app.a"], marker);
  });
});
