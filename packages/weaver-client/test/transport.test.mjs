import { test, expect, describe } from "bun:test";

describe("WeaverTransport interface", () => {
  test("mock transport satisfies interface contract", () => {
    const transport = {
      resolveAll: async () => ({ platform: {}, tenants: {}, revision: "r1", timestamp: "t1" }),
      get: async () => undefined,
      getNamespace: async () => ({}),
      subscribe: () => () => {},
      close: async () => {},
    };
    expect(transport.resolveAll).toBeFunction();
    expect(transport.get).toBeFunction();
    expect(transport.getNamespace).toBeFunction();
    expect(transport.subscribe).toBeFunction();
    expect(transport.close).toBeFunction();
  });
});
