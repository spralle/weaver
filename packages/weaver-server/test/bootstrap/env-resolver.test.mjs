import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveEnvVars } from "../../src/bootstrap/env-resolver.ts";

test("resolves ${VAR} with env map", () => {
  const result = resolveEnvVars("${MY_VAR}", { MY_VAR: "hello" });
  assert.equal(result, "hello");
});

test("leaves non-placeholder strings unchanged", () => {
  const result = resolveEnvVars("plain string", {});
  assert.equal(result, "plain string");
});

test("resolves nested objects", () => {
  const input = { a: "${X}", b: { c: "${Y}" }, d: [1, "${Z}"] };
  const result = resolveEnvVars(input, { X: "1", Y: "2", Z: "3" });
  assert.deepEqual(result, { a: "1", b: { c: "2" }, d: [1, "3"] });
});

test("throws on missing env var", () => {
  assert.throws(
    () => resolveEnvVars("${MISSING}", {}),
    { message: 'Environment variable "MISSING" is not defined' },
  );
});

test("passes through non-string primitives", () => {
  assert.equal(resolveEnvVars(42, {}), 42);
  assert.equal(resolveEnvVars(null, {}), null);
  assert.equal(resolveEnvVars(true, {}), true);
});
