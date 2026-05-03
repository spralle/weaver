import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
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
    assert.equal(extractErrorMessage(new Error("boom")), "boom");
  });
  it("returns String() for non-errors", () => {
    assert.equal(extractErrorMessage(42), "42");
    assert.equal(extractErrorMessage(null), "null");
  });
});

describe("isNodeError", () => {
  it("returns true for errors with code property", () => {
    const err = Object.assign(new Error("fail"), { code: "ENOENT" });
    assert.equal(isNodeError(err), true);
  });
  it("returns false for plain errors", () => {
    assert.equal(isNodeError(new Error("plain")), false);
  });
});

describe("readonlyGuard", () => {
  it("returns readonly WriteResult", () => {
    const result = readonlyGuard("env-provider");
    assert.deepEqual(result, { success: false, error: "env-provider is read-only" });
  });
});

describe("cloneValue", () => {
  it("deep-clones an object", () => {
    const original = { a: { b: 1 } };
    const clone = cloneValue(original);
    clone.a.b = 99;
    assert.equal(original.a.b, 1);
  });
});

describe("safeParseConfigEntries", () => {
  it("returns valid entries", () => {
    const result = safeParseConfigEntries({ foo: "bar" });
    assert.deepEqual(result, { foo: "bar" });
  });
  it("throws on non-object input", () => {
    assert.throws(() => safeParseConfigEntries("not-an-object"));
  });
});

describe("consoleLogger", () => {
  it("has warn and error methods", () => {
    assert.equal(typeof consoleLogger.warn, "function");
    assert.equal(typeof consoleLogger.error, "function");
  });
});
