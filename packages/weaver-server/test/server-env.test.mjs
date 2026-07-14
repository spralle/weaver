import { parseServerEnv, serverEnvSchema } from "../src/server-env.ts";

describe("serverEnvSchema", () => {
  test("accepts empty env (all optional)", () => {
    const result = serverEnvSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("accepts valid port", () => {
    const result = serverEnvSchema.safeParse({ WEAVER_PORT: "8080" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.WEAVER_PORT).toBe(8080);
    }
  });

  test("rejects port out of range (0)", () => {
    const result = serverEnvSchema.safeParse({ WEAVER_PORT: "0" });
    expect(result.success).toBe(false);
  });

  test("rejects port out of range (99999)", () => {
    const result = serverEnvSchema.safeParse({ WEAVER_PORT: "99999" });
    expect(result.success).toBe(false);
  });

  test("rejects non-numeric port", () => {
    const result = serverEnvSchema.safeParse({ WEAVER_PORT: "abc" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid WEAVER_MONGO_URI", () => {
    const result = serverEnvSchema.safeParse({ WEAVER_MONGO_URI: "not-a-url" });
    expect(result.success).toBe(false);
  });

  test("accepts valid WEAVER_MONGO_URI", () => {
    const result = serverEnvSchema.safeParse({
      WEAVER_MONGO_URI: "mongodb://localhost:27017/weaver",
    });
    expect(result.success).toBe(true);
  });
});

describe("parseServerEnv", () => {
  test("throws with actionable message on invalid env", () => {
    try {
      parseServerEnv({ WEAVER_PORT: "invalid" });
      throw new Error("Expected parseServerEnv to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      if (!(err instanceof Error)) {
        return;
      }
      expect(err.message).toContain("Invalid server environment variables");
    }
  });

  test("returns parsed env for valid input", () => {
    const env = parseServerEnv({ WEAVER_PORT: "3000" });
    expect(env.WEAVER_PORT).toBe(3000);
  });
});
