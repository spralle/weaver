import { z } from "zod";
import { defineNamespace } from "../src/namespace.js";
import {
  createTypedNamespaceClient,
  type NamespaceClientDeps,
} from "../src/typed-namespace-client.js";

const testNamespace = defineNamespace("editor", {
  fontSize: z.number().min(8).max(72),
  theme: z.enum(["light", "dark"]),
  wordWrap: z.boolean(),
});

function createMockDeps(state: Record<string, unknown>): NamespaceClientDeps {
  const listeners: Array<{
    pattern: string;
    handler: (deltas: unknown[]) => void;
  }> = [];
  return {
    getState: () => state,
    set: async (key, value) => {
      // Simulate setting in state
      const parts = key.split(".");
      let obj = state;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]] || typeof obj[parts[i]] !== "object") {
          obj[parts[i]] = {};
        }
        obj = obj[parts[i]] as Record<string, unknown>;
      }
      obj[parts[parts.length - 1]] = value;
      return { success: true, revision: "r2" };
    },
    remove: async () => ({ success: true, revision: "r3" }),
    onChange: (pattern, handler) => {
      listeners.push({ pattern, handler });
      return () => {};
    },
  };
}

describe("createTypedNamespaceClient", () => {
  it("get() returns typed value from state", () => {
    const state = { editor: { fontSize: 14, theme: "dark", wordWrap: true } };
    const client = createTypedNamespaceClient(
      testNamespace,
      createMockDeps(state),
    );
    expect(client.get("fontSize")).toBe(14);
    expect(client.get("theme")).toBe("dark");
  });

  it("get() returns undefined when key not in state", () => {
    const state = { editor: {} };
    const client = createTypedNamespaceClient(
      testNamespace,
      createMockDeps(state),
    );
    expect(client.get("fontSize")).toBe(undefined);
  });

  it("get() returns undefined when value fails Zod validation", () => {
    const state = { editor: { fontSize: 999, theme: "invalid" } };
    const client = createTypedNamespaceClient(
      testNamespace,
      createMockDeps(state),
    );
    expect(client.get("fontSize")).toBe(undefined);
    expect(client.get("theme")).toBe(undefined);
  });

  it("getOrDefault() returns default when missing", () => {
    const state = { editor: {} };
    const client = createTypedNamespaceClient(
      testNamespace,
      createMockDeps(state),
    );
    expect(client.getOrDefault("fontSize", 16)).toBe(16);
  });

  it("getOrDefault() returns value when present", () => {
    const state = { editor: { fontSize: 12 } };
    const client = createTypedNamespaceClient(
      testNamespace,
      createMockDeps(state),
    );
    expect(client.getOrDefault("fontSize", 16)).toBe(12);
  });

  it("getAll() returns all valid namespace entries", () => {
    const state = { editor: { fontSize: 14, theme: "light", wordWrap: false } };
    const client = createTypedNamespaceClient(
      testNamespace,
      createMockDeps(state),
    );
    const all = client.getAll();
    expect(all).toEqual({ fontSize: 14, theme: "light", wordWrap: false });
  });

  it("getAll() skips invalid entries", () => {
    const state = { editor: { fontSize: 14, theme: "invalid" } };
    const client = createTypedNamespaceClient(
      testNamespace,
      createMockDeps(state),
    );
    const all = client.getAll();
    expect(all).toEqual({ fontSize: 14 });
  });

  it("set() succeeds with valid value", async () => {
    const state = { editor: {} };
    const client = createTypedNamespaceClient(
      testNamespace,
      createMockDeps(state),
    );
    const result = await client.set("fontSize", 20);
    expect(result.success).toBe(true);
  });

  it("set() returns VALIDATION_ERROR for invalid value", async () => {
    const state = { editor: {} };
    const client = createTypedNamespaceClient(
      testNamespace,
      createMockDeps(state),
    );
    // @ts-expect-error - intentionally passing invalid value for test
    const result = await client.set("fontSize", "not-a-number");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
  });

  it("withScope() returns client reading from scope state", () => {
    const scopeState = { editor: { fontSize: 18 } };
    const deps: NamespaceClientDeps = {
      getState: (scopePath) => {
        if (scopePath && scopePath.length > 0) return scopeState;
        return {};
      },
      set: async () => ({ success: true }),
      remove: async () => ({ success: true }),
      onChange: () => () => {},
    };
    const client = createTypedNamespaceClient(testNamespace, deps);
    const scoped = client.withScope([{ scope: "project", value: "myapp" }]);
    expect(scoped.get("fontSize")).toBe(18);
  });

  it("instance() reads from instance path with base fallback", () => {
    const state = {
      editor: {
        fontSize: 14,
        theme: "dark",
        instances: { panel1: { fontSize: 20 } },
      },
    };
    const client = createTypedNamespaceClient(
      testNamespace,
      createMockDeps(state),
    );
    const inst = client.instance("panel1");
    // Instance override
    expect(inst.get("fontSize")).toBe(20);
    // Falls back to base
    expect(inst.get("theme")).toBe("dark");
  });
});
