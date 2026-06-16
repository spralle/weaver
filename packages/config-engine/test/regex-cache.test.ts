import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  clearRegexCache,
  getCachedRegex,
  isSafePattern,
} from "../src/regex-cache.js";

describe("getCachedRegex", () => {
  beforeEach(() => clearRegexCache());

  it("returns a RegExp for the given pattern", () => {
    const re = getCachedRegex("foo");
    assert.ok(re instanceof RegExp);
    assert.ok(re.test("foo"));
  });

  it("returns the same instance on repeated calls", () => {
    const a = getCachedRegex("bar", "i");
    const b = getCachedRegex("bar", "i");
    assert.strictEqual(a, b);
  });

  it("returns different instances for different flags", () => {
    const a = getCachedRegex("baz", "i");
    const b = getCachedRegex("baz", "g");
    assert.notStrictEqual(a, b);
  });
});

describe("isSafePattern", () => {
  it("accepts simple patterns", () => {
    assert.equal(isSafePattern("^foo$"), true);
    assert.equal(isSafePattern("[a-z]+"), true);
  });

  it("rejects patterns over 200 chars", () => {
    assert.equal(isSafePattern("a".repeat(201)), false);
  });

  it("rejects nested quantifiers", () => {
    assert.equal(isSafePattern("(a+)+"), false);
    assert.equal(isSafePattern("(a*)*"), false);
  });
});
