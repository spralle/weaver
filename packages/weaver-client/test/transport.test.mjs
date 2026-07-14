
describe("WeaverTransport interface", () => {
  test("mock transport satisfies interface contract", () => {
    const transport = {
      resolveAll: async () => ({ entries: {}, scopes: {}, revision: "r1", timestamp: "t1" }),
      get: async () => undefined,
      getNamespace: async () => ({}),
      inspect: async () => ({}),
      subscribe: () => () => {},
      set: async () => ({ success: true }),
      setMany: async () => ({ success: true }),
      remove: async () => ({ success: true }),
      listScopes: async () => [],
      listScopeValues: async () => [],
      close: async () => {},
    };
    expect(typeof transport.resolveAll).toBe("function");
    expect(typeof transport.get).toBe("function");
    expect(typeof transport.getNamespace).toBe("function");
    expect(typeof transport.inspect).toBe("function");
    expect(typeof transport.subscribe).toBe("function");
    expect(typeof transport.set).toBe("function");
    expect(typeof transport.setMany).toBe("function");
    expect(typeof transport.remove).toBe("function");
    expect(typeof transport.listScopes).toBe("function");
    expect(typeof transport.listScopeValues).toBe("function");
    expect(typeof transport.close).toBe("function");
  });
});
