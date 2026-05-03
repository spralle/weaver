import { describe, expect, test } from "bun:test";
import { createJwtValidator } from "../../src/auth/jwt-validator.js";

const SECRET = "test-secret-key-for-hmac-256";

function base64Url(data: string | Uint8Array): string {
  const str = typeof data === "string" ? data : String.fromCharCode(...data);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createTestJwt(
  payload: Record<string, unknown>,
  secret = SECRET,
): Promise<string> {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput)),
  );
  return `${header}.${body}.${base64Url(sig)}`;
}

describe("JwtValidator", () => {
  const validator = createJwtValidator({ publicKeyOrSecret: SECRET });

  test("valid user token returns correct identity", async () => {
    const token = await createTestJwt({
      sub: "user-123",
      roles: ["editor"],
      scopes: ["read", "write"],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const identity = await validator.validate(token);
    expect(identity.userId).toBe("user-123");
    expect(identity.roles).toEqual(["editor"]);
    expect(identity.scopes).toEqual(["read", "write"]);
  });

  test("M2M token extracts serviceId", async () => {
    const token = await createTestJwt({
      serviceId: "svc-deploy",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const identity = await validator.validate(token);
    expect(identity.serviceId).toBe("svc-deploy");
    expect(identity.userId).toBeUndefined();
  });

  test("expired token throws UNAUTHORIZED", async () => {
    const token = await createTestJwt({
      sub: "user-1",
      exp: Math.floor(Date.now() / 1000) - 100,
    });
    await expect(validator.validate(token)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Token expired",
    });
  });

  test("invalid signature throws UNAUTHORIZED", async () => {
    const token = await createTestJwt(
      { sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 },
      "wrong-secret",
    );
    await expect(validator.validate(token)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid signature",
    });
  });

  test("invalid issuer throws UNAUTHORIZED", async () => {
    const v = createJwtValidator({
      publicKeyOrSecret: SECRET,
      issuer: "expected-issuer",
    });
    const token = await createTestJwt({
      sub: "user-1",
      iss: "wrong-issuer",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    await expect(v.validate(token)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid issuer",
    });
  });

  test("malformed token throws UNAUTHORIZED", async () => {
    await expect(validator.validate("not.a.valid-token")).rejects.toMatchObject(
      {
        code: "UNAUTHORIZED",
      },
    );
  });
});
