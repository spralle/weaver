import { consoleLogger } from "../dist/index.js";

describe("consoleLogger", () => {
  let captured = [];
  const origDebug = console.debug;
  const origInfo = console.info;
  const origWarn = console.warn;
  const origError = console.error;

  beforeEach(() => {
    captured = [];
    const capture =
      (level) =>
      (...args) =>
        captured.push({ level, args });
    console.debug = capture("debug");
    console.info = capture("info");
    console.warn = capture("warn");
    console.error = capture("error");
  });

  afterEach(() => {
    console.debug = origDebug;
    console.info = origInfo;
    console.warn = origWarn;
    console.error = origError;
  });

  it("supports debug level", () => {
    consoleLogger.debug("test message");
    expect(captured.length).toBe(1);
    expect(captured[0].level).toBe("debug");
    expect(captured[0].args[0]).toBe("test message");
  });

  it("supports info level", () => {
    consoleLogger.info("hello");
    expect(captured[0].level).toBe("info");
    expect(captured[0].args[0]).toBe("hello");
  });

  it("backward compat: warn with extra args", () => {
    consoleLogger.warn("oops:", "detail");
    expect(captured[0].level).toBe("warn");
    expect(captured[0].args).toEqual(["oops:", "detail"]);
  });

  it("backward compat: error with extra args", () => {
    const err = new Error("fail");
    consoleLogger.error("broken:", err);
    expect(captured[0].level).toBe("error");
    expect(captured[0].args[0]).toBe("broken:");
    expect(captured[0].args[1]).toBe(err);
  });

  it("outputs structured JSON when LogFields provided", () => {
    consoleLogger.info("request", {
      correlationId: "abc-123",
      context: { userId: 42 },
    });
    expect(captured.length).toBe(1);
    const parsed = JSON.parse(captured[0].args[0]);
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("request");
    expect(parsed.correlationId).toBe("abc-123");
    expect(parsed.context).toEqual({ userId: 42 });
    expect(parsed.timestamp).toBeTruthy();
  });

  it("structured output works for all levels", () => {
    const fields = { correlationId: "x" };
    consoleLogger.debug("d", fields);
    consoleLogger.info("i", fields);
    consoleLogger.warn("w", fields);
    consoleLogger.error("e", fields);
    expect(captured.length).toBe(4);
    for (const entry of captured) {
      const parsed = JSON.parse(entry.args[0]);
      expect(parsed.correlationId).toBe("x");
    }
  });

  it("does not treat arbitrary objects as LogFields", () => {
    consoleLogger.info("msg", { foo: "bar" });
    // Should pass through as regular args, not structured
    expect(captured[0].args).toEqual(["msg", { foo: "bar" }]);
  });
});
