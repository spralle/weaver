import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import type { WriteResult } from "../src/transport.js";
import type { UntypedNamespaceClientDeps } from "../src/untyped-namespace-client.js";
import { createUntypedNamespaceClient } from "../src/untyped-namespace-client.js";

function createMockDeps(
  state: Record<string, unknown>,
): UntypedNamespaceClientDeps & {
  calls: Array<{ method: string; args: unknown[] }>;
} {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const success: WriteResult = { success: true, revision: "r1" };

  return {
    calls,
    getState: () => state,
    set: async (key, value, opts) => {
      calls.push({ method: "set", args: [key, value, opts] });
      return success;
    },
    setMany: async (entries, opts) => {
      calls.push({ method: "setMany", args: [entries, opts] });
      return success;
    },
    remove: async (key, opts) => {
      calls.push({ method: "remove", args: [key, opts] });
      return success;
    },
    onChange: (pattern, handler) => {
      calls.push({ method: "onChange", args: [pattern, handler] });
      return () => {};
    },
  };
}

describe("UntypedNamespaceClient", () => {
  it("auto-prefixes get calls", () => {
    const state = { editor: { fontSize: 14, theme: "dark" } };
    const deps = createMockDeps(state);
    const client = createUntypedNamespaceClient("editor", deps);

    assert.equal(client.get("fontSize"), 14);
    assert.equal(client.get("theme"), "dark");
    assert.equal(client.get("missing"), undefined);
  });

  it("auto-prefixes set calls", async () => {
    const deps = createMockDeps({});
    const client = createUntypedNamespaceClient("editor", deps);

    await client.set("fontSize", 16);
    assert.equal(deps.calls[0].method, "set");
    assert.deepEqual(deps.calls[0].args[0], "editor.fontSize");
  });

  it("getAll returns all keys under prefix", () => {
    const state = { editor: { fontSize: 14, theme: "dark" } };
    const deps = createMockDeps(state);
    const client = createUntypedNamespaceClient("editor", deps);

    assert.deepEqual(client.getAll(), { fontSize: 14, theme: "dark" });
  });

  it("setMany prefixes all keys", async () => {
    const deps = createMockDeps({});
    const client = createUntypedNamespaceClient("editor", deps);

    await client.setMany({ fontSize: 16, theme: "light" });
    assert.equal(deps.calls[0].method, "setMany");
    const entries = deps.calls[0].args[0] as Record<string, unknown>;
    assert.deepEqual(entries, {
      "editor.fontSize": 16,
      "editor.theme": "light",
    });
  });

  it("get with schema validates the value", () => {
    const state = { editor: { fontSize: "not-a-number" } };
    const deps = createMockDeps(state);
    const client = createUntypedNamespaceClient("editor", deps);

    const result = client.get("fontSize", z.number());
    assert.equal(result, undefined);
  });

  it("get with schema returns valid value", () => {
    const state = { editor: { fontSize: 14 } };
    const deps = createMockDeps(state);
    const client = createUntypedNamespaceClient("editor", deps);

    const result = client.get("fontSize", z.number());
    assert.equal(result, 14);
  });

  it("withScope returns scoped version", () => {
    const state = { editor: { fontSize: 14 } };
    const deps = createMockDeps(state);
    const client = createUntypedNamespaceClient("editor", deps);

    const scoped = client.withScope([{ scope: "user", value: "alice" }]);
    assert.ok(scoped);
    assert.equal(typeof scoped.get, "function");
  });

  it("instance returns instance client", () => {
    const state = { editor: { fontSize: 14 } };
    const deps = createMockDeps(state);
    const client = createUntypedNamespaceClient("editor", deps);

    const inst = client.instance("panel-1");
    assert.ok(inst);
    assert.equal(typeof inst.get, "function");
    assert.equal(typeof inst.set, "function");
  });

  it("getOrDefault returns default when key missing", () => {
    const state = { editor: {} };
    const deps = createMockDeps(state);
    const client = createUntypedNamespaceClient("editor", deps);

    assert.equal(client.getOrDefault("fontSize", 12), 12);
  });
});
