import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInstanceClient,
  type InstanceClientDeps,
} from "../src/instance-client.js";
import type { WriteResult } from "../src/transport.js";

function makeDeps(
  state: Record<string, unknown>,
  overrides?: Partial<InstanceClientDeps>,
): InstanceClientDeps & {
  calls: { set: unknown[][]; remove: unknown[][]; onChange: unknown[][] };
} {
  const successResult: WriteResult = { success: true, revision: "r1" };
  const calls = {
    set: [] as unknown[][],
    remove: [] as unknown[][],
    onChange: [] as unknown[][],
  };
  return {
    getState: () => state,
    set: async (...args) => {
      calls.set.push(args);
      return successResult;
    },
    remove: async (...args) => {
      calls.remove.push(args);
      return successResult;
    },
    onChange: (...args) => {
      calls.onChange.push(args);
      return () => {};
    },
    calls,
    ...overrides,
  };
}

describe("createInstanceClient", () => {
  it("get() reads from instance path when override exists", () => {
    const state = {
      editor: { instances: { vim: { theme: "dark" } }, theme: "light" },
    };
    const client = createInstanceClient("editor", "vim", makeDeps(state));
    assert.equal(client.get("theme"), "dark");
  });

  it("get() falls back to base path when no override", () => {
    const state = { editor: { instances: { vim: {} }, theme: "light" } };
    const client = createInstanceClient("editor", "vim", makeDeps(state));
    assert.equal(client.get("theme"), "light");
  });

  it("get() returns undefined when neither exists", () => {
    const state = { editor: { instances: { vim: {} } } };
    const client = createInstanceClient("editor", "vim", makeDeps(state));
    assert.equal(client.get("missing"), undefined);
  });

  it("getOrDefault() returns default when missing", () => {
    const state = { editor: { instances: { vim: {} } } };
    const client = createInstanceClient("editor", "vim", makeDeps(state));
    assert.equal(client.getOrDefault("missing", 42), 42);
  });

  it("set() writes to instance path", async () => {
    const deps = makeDeps({});
    const client = createInstanceClient("editor", "vim", deps);
    await client.set("theme", "dark");
    assert.equal(deps.calls.set.length, 1);
    assert.equal(deps.calls.set[0][0], "editor.instances.vim.theme");
    assert.equal(deps.calls.set[0][1], "dark");
  });

  it("set() uses defaultWriteLayer", async () => {
    const calls = {
      set: [] as unknown[][],
      remove: [] as unknown[][],
      onChange: [] as unknown[][],
    };
    const deps: InstanceClientDeps & { calls: typeof calls } = {
      getState: () => ({}),
      set: async (...args) => {
        calls.set.push(args);
        return { success: true };
      },
      remove: async (...args) => {
        calls.remove.push(args);
        return { success: true };
      },
      onChange: (...args) => {
        calls.onChange.push(args);
        return () => {};
      },
      defaultWriteLayer: "user",
      calls,
    };
    const client = createInstanceClient("editor", "vim", deps);
    await client.set("theme", "dark");
    assert.deepEqual(calls.set[0][2], { layer: "user" });
  });

  it("reset() removes the entire instance prefix", async () => {
    const deps = makeDeps({});
    const client = createInstanceClient("editor", "vim", deps);
    await client.reset();
    assert.equal(deps.calls.remove.length, 1);
    assert.equal(deps.calls.remove[0][0], "editor.instances.vim");
  });

  it("onChange subscribes to instance-prefixed pattern", () => {
    const deps = makeDeps({});
    const handler = () => {};
    const client = createInstanceClient("editor", "vim", deps);
    client.onChange("theme", handler);
    assert.equal(deps.calls.onChange[0][0], "editor.instances.vim.theme");
  });
});
