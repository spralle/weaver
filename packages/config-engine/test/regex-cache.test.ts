import {
  clearRegexCache,
  getCachedRegex,
  isSafePattern,
} from "../src/regex-cache.js";

describe("getCachedRegex", () => {
  beforeEach(() => clearRegexCache());

  it("returns a RegExp for the given pattern", () => {
    const re = getCachedRegex("foo");
    expect(re instanceof RegExp).toBeTruthy();
    expect(re.test("foo")).toBeTruthy();
  });

  it("returns the same instance on repeated calls", () => {
    const a = getCachedRegex("bar", "i");
    const b = getCachedRegex("bar", "i");
    expect(a).toBe(b);
  });

  it("returns different instances for different flags", () => {
    const a = getCachedRegex("baz", "i");
    const b = getCachedRegex("baz", "g");
    expect(a).not.toBe(b);
  });
});

describe("isSafePattern", () => {
  it("accepts simple patterns", () => {
    expect(isSafePattern("^foo$")).toBe(true);
    expect(isSafePattern("[a-z]+")).toBe(true);
  });

  it("rejects patterns over 200 chars", () => {
    expect(isSafePattern("a".repeat(201))).toBe(false);
  });

  it("rejects nested quantifiers", () => {
    expect(isSafePattern("(a+)+")).toBe(false);
    expect(isSafePattern("(a*)*")).toBe(false);
  });
});
