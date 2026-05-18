import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseServerEnv, serverEnvSchema } from "../src/server-env.ts";

describe("serverEnvSchema", () => {
  test("accepts empty env (all optional)", () => {
    const result = serverEnvSchema.safeParse({});
    assert.strictEqual(result.success, true);
  });

  test("accepts valid port", () => {
    const result = serverEnvSchema.safeParse({ WEAVER_PORT: "8080" });
    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.WEAVER_PORT, 8080);
    }
  });

  test("rejects port out of range (0)", () => {
    const result = serverEnvSchema.safeParse({ WEAVER_PORT: "0" });
    assert.strictEqual(result.success, false);
  });

  test("rejects port out of range (99999)", () => {
    const result = serverEnvSchema.safeParse({ WEAVER_PORT: "99999" });
    assert.strictEqual(result.success, false);
  });

  test("rejects non-numeric port", () => {
    const result = serverEnvSchema.safeParse({ WEAVER_PORT: "abc" });
    assert.strictEqual(result.success, false);
  });

  test("rejects invalid WEAVER_MONGO_URI", () => {
    const result = serverEnvSchema.safeParse({ WEAVER_MONGO_URI: "not-a-url" });
    assert.strictEqual(result.success, false);
  });

  test("accepts valid WEAVER_MONGO_URI", () => {
    const result = serverEnvSchema.safeParse({
      WEAVER_MONGO_URI: "mongodb://localhost:27017/weaver",
    });
    assert.strictEqual(result.success, true);
  });
});

describe("parseServerEnv", () => {
  test("throws with actionable message on invalid env", () => {
    assert.throws(
      () => parseServerEnv({ WEAVER_PORT: "invalid" }),
      (err) => err.message.includes("Invalid server environment variables"),
    );
  });

  test("returns parsed env for valid input", () => {
    const env = parseServerEnv({ WEAVER_PORT: "3000" });
    assert.strictEqual(env.WEAVER_PORT, 3000);
  });
});
