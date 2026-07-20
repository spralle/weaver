import { resolveEnvVars } from "../../src/bootstrap/env-resolver.ts";

test("resolves ${VAR} with env map", () => {
  const result = resolveEnvVars("${MY_VAR}", { MY_VAR: "hello" });
  expect(result).toBe("hello");
});

test("leaves non-placeholder strings unchanged", () => {
  const result = resolveEnvVars("plain string", {});
  expect(result).toBe("plain string");
});

test("resolves nested objects", () => {
  const input = { a: "${X}", b: { c: "${Y}" }, d: [1, "${Z}"] };
  const result = resolveEnvVars(input, { X: "1", Y: "2", Z: "3" });
  expect(result).toEqual({ a: "1", b: { c: "2" }, d: [1, "3"] });
});

test("throws on missing env var", () => {
  expect(() => resolveEnvVars("${MISSING}", {})).toThrow(
    'Environment variable "MISSING" is not defined',
  );
});

test("passes through non-string primitives", () => {
  expect(resolveEnvVars(42, {})).toBe(42);
  expect(resolveEnvVars(null, {})).toBe(null);
  expect(resolveEnvVars(true, {})).toBe(true);
});
