import {
  extractErrorMessage,
  isNodeError,
  readonlyGuard,
  cloneValue,
  safeParseConfigEntries,
  consoleLogger,
} from "../dist/index.js";

describe("extractErrorMessage", () => {
  it("returns .message for Error instances", () => {
    expect(extractErrorMessage(new Error("boom"))).toBe("boom");
  });
  it("returns String() for non-errors", () => {
    expect(extractErrorMessage(42)).toBe("42");
    expect(extractErrorMessage(null)).toBe("null");
  });
});

describe("isNodeError", () => {
  it("returns true for errors with code property", () => {
    const err = Object.assign(new Error("fail"), { code: "ENOENT" });
    expect(isNodeError(err)).toBe(true);
  });
  it("returns false for plain errors", () => {
    expect(isNodeError(new Error("plain"))).toBe(false);
  });
});

describe("readonlyGuard", () => {
  it("returns readonly WriteResult", () => {
    const result = readonlyGuard("env-provider");
    expect(result).toEqual({ success: false, error: { code: "READONLY", message: "env-provider is read-only" } });
  });
});

describe("cloneValue", () => {
  it("deep-clones an object", () => {
    const original = { a: { b: 1 } };
    const clone = cloneValue(original);
    clone.a.b = 99;
    expect(original.a.b).toBe(1);
  });
});

describe("safeParseConfigEntries", () => {
  it("returns valid entries", () => {
    const result = safeParseConfigEntries({ foo: "bar" });
    expect(result).toEqual({ foo: "bar" });
  });
  it("throws on non-object input", () => {
    expect(() => safeParseConfigEntries("not-an-object")).toThrow();
  });
});

describe("consoleLogger", () => {
  it("has warn and error methods", () => {
    expect(typeof consoleLogger.warn).toBe("function");
    expect(typeof consoleLogger.error).toBe("function");
  });
});
