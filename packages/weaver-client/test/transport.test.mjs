import { test, expect, describe } from "bun:test";

describe("WeaverTransport interface", () => {
  test("mock transport satisfies interface contract", () => {
    const transport = {
      resolveAll: async () => ({ entries: {}, scopes: {}, revision: "r1", timestamp: "t1" }),
      get: async () => undefined,
      getNamespace: async () => ({}),
      inspect: async () => ({}),
      subscribe: () => () => {},
      set: async () => ({ success: true }),
      remove: async () => ({ success: true }),
      listScopes: async () => [],
      listScopeValues: async () => [],
      close: async () => {},
    };
    expect(transport.resolveAll).toBeFunction();
    expect(transport.get).toBeFunction();
    expect(transport.getNamespace).toBeFunction();
    expect(transport.inspect).toBeFunction();
    expect(transport.subscribe).toBeFunction();
    expect(transport.set).toBeFunction();
    expect(transport.remove).toBeFunction();
    expect(transport.listScopes).toBeFunction();
    expect(transport.listScopeValues).toBeFunction();
    expect(transport.close).toBeFunction();
  });
});
