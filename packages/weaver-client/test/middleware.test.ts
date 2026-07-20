import { type TransportMiddleware, withMiddleware } from "../src/middleware.js";
import type { WeaverTransport } from "../src/transport.js";

function createMockTransport(): WeaverTransport {
  return {
    async resolveAll() {
      return { entries: {}, scopes: {}, revision: "1", timestamp: "" };
    },
    async get(key) {
      return `value-${key}`;
    },
    async getNamespace() {
      return {};
    },
    async inspect() {
      return {};
    },
    subscribe(_handler) {
      return () => {};
    },
    async set() {
      return { success: true, revision: "2" };
    },
    async setMany() {
      return { success: true, revision: "2" };
    },
    async remove() {
      return { success: true, revision: "2" };
    },
    async listScopes() {
      return [];
    },
    async listScopeValues() {
      return [];
    },
    async close() {},
  };
}

describe("withMiddleware", () => {
  it("fires onBeforeGet and onAfterGet", async () => {
    const calls: string[] = [];
    const mw: TransportMiddleware = {
      onBeforeGet(key) {
        calls.push(`before:${key}`);
      },
      onAfterGet(key, value) {
        calls.push(`after:${key}:${value}`);
      },
    };
    const wrapped = withMiddleware(createMockTransport(), mw);
    const result = await wrapped.get("foo");
    expect(result).toBe("value-foo");
    expect(calls).toEqual(["before:foo", "after:foo:value-foo"]);
  });

  it("fires onBeforeSet and onAfterSet", async () => {
    const calls: string[] = [];
    const mw: TransportMiddleware = {
      onBeforeSet(key, value) {
        calls.push(`before:${key}:${value}`);
      },
      onAfterSet(key, result) {
        calls.push(`after:${key}:${result.success}`);
      },
    };
    const wrapped = withMiddleware(createMockTransport(), mw);
    await wrapped.set("k", "v");
    expect(calls).toEqual(["before:k:v", "after:k:true"]);
  });

  it("fires onDelta on subscribe", () => {
    const deltas: unknown[] = [];
    const mw: TransportMiddleware = {
      onDelta(delta) {
        deltas.push(delta);
      },
    };
    const transport = createMockTransport();
    let capturedHandler: ((d: unknown) => void) | undefined;
    transport.subscribe = (handler) => {
      capturedHandler = handler;
      return () => {};
    };
    const wrapped = withMiddleware(transport, mw);
    const handler = (_d: unknown) => {};
    wrapped.subscribe(handler);
    expect(capturedHandler).toBeTruthy();
    capturedHandler({ key: "x", value: 1 });
    expect(deltas.length).toBe(1);
  });

  it("fires onError on failure", async () => {
    const errors: unknown[] = [];
    const mw: TransportMiddleware = {
      onError(_method, err) {
        errors.push(err);
      },
    };
    const transport = createMockTransport();
    transport.get = async () => {
      throw new Error("fail");
    };
    const wrapped = withMiddleware(transport, mw);
    await expect(wrapped.get("x")).rejects.toThrow();
    expect(errors.length).toBe(1);
  });
});
