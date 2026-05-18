import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
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
    assert.equal(captured.length, 1);
    assert.equal(captured[0].level, "debug");
    assert.equal(captured[0].args[0], "test message");
  });

  it("supports info level", () => {
    consoleLogger.info("hello");
    assert.equal(captured[0].level, "info");
    assert.equal(captured[0].args[0], "hello");
  });

  it("backward compat: warn with extra args", () => {
    consoleLogger.warn("oops:", "detail");
    assert.equal(captured[0].level, "warn");
    assert.deepEqual(captured[0].args, ["oops:", "detail"]);
  });

  it("backward compat: error with extra args", () => {
    const err = new Error("fail");
    consoleLogger.error("broken:", err);
    assert.equal(captured[0].level, "error");
    assert.equal(captured[0].args[0], "broken:");
    assert.equal(captured[0].args[1], err);
  });

  it("outputs structured JSON when LogFields provided", () => {
    consoleLogger.info("request", {
      correlationId: "abc-123",
      context: { userId: 42 },
    });
    assert.equal(captured.length, 1);
    const parsed = JSON.parse(captured[0].args[0]);
    assert.equal(parsed.level, "info");
    assert.equal(parsed.message, "request");
    assert.equal(parsed.correlationId, "abc-123");
    assert.deepEqual(parsed.context, { userId: 42 });
    assert.ok(parsed.timestamp);
  });

  it("structured output works for all levels", () => {
    const fields = { correlationId: "x" };
    consoleLogger.debug("d", fields);
    consoleLogger.info("i", fields);
    consoleLogger.warn("w", fields);
    consoleLogger.error("e", fields);
    assert.equal(captured.length, 4);
    for (const entry of captured) {
      const parsed = JSON.parse(entry.args[0]);
      assert.equal(parsed.correlationId, "x");
    }
  });

  it("does not treat arbitrary objects as LogFields", () => {
    consoleLogger.info("msg", { foo: "bar" });
    // Should pass through as regular args, not structured
    assert.deepEqual(captured[0].args, ["msg", { foo: "bar" }]);
  });
});
