import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createAuthMiddleware } from "../../src/auth/auth-middleware.ts";

function mockValidator(identity) {
  return {
    async validate(_token) {
      return identity;
    },
  };
}

function failingValidator(error) {
  return {
    async validate(_token) {
      throw error;
    },
  };
}

describe("AuthMiddleware", () => {
  const userIdentity = {
    userId: "user-42",
    roles: ["editor"],
    claims: { sub: "user-42", roles: ["editor"] },
  };

  const serviceIdentity = {
    serviceId: "svc-deploy",
    claims: { serviceId: "svc-deploy" },
  };

  const adminIdentity = {
    userId: "admin-1",
    roles: ["admin"],
    claims: { sub: "admin-1", roles: ["admin"] },
  };

  test("authenticate with valid token returns AuthContext", async () => {
    const mw = createAuthMiddleware({
      jwtValidator: mockValidator(userIdentity),
    });
    const ctx = await mw.authenticate("valid-token");
    assert.strictEqual(ctx.identity.userId, "user-42");
    assert.strictEqual(ctx.isUser, true);
    assert.strictEqual(ctx.isService, false);
    assert.strictEqual(ctx.isAdmin, false);
  });

  test("authenticate with missing token throws UNAUTHORIZED", async () => {
    const mw = createAuthMiddleware({
      jwtValidator: mockValidator(userIdentity),
    });
    await assert.rejects(
      mw.authenticate(undefined),
      (err) => err.code === "UNAUTHORIZED",
    );
  });

  test("authenticate with invalid token throws UNAUTHORIZED", async () => {
    const mw = createAuthMiddleware({
      jwtValidator: failingValidator({
        code: "UNAUTHORIZED",
        message: "Invalid signature",
      }),
    });
    await assert.rejects(
      mw.authenticate("bad-token"),
      (err) => err.code === "UNAUTHORIZED",
    );
  });

  test("isService=true for M2M tokens", async () => {
    const mw = createAuthMiddleware({
      jwtValidator: mockValidator(serviceIdentity),
    });
    const ctx = await mw.authenticate("svc-token");
    assert.strictEqual(ctx.isService, true);
    assert.strictEqual(ctx.isAdmin, true);
    assert.strictEqual(ctx.isUser, false);
  });

  test("requireAdmin with admin role passes", () => {
    const mw = createAuthMiddleware({
      jwtValidator: mockValidator(adminIdentity),
    });
    const ctx = {
      identity: adminIdentity,
      isAdmin: true,
      isService: false,
      isUser: true,
    };
    assert.doesNotThrow(() => mw.requireAdmin(ctx));
  });

  test("requireAdmin without admin role throws FORBIDDEN", () => {
    const mw = createAuthMiddleware({
      jwtValidator: mockValidator(userIdentity),
    });
    const ctx = {
      identity: userIdentity,
      isAdmin: false,
      isService: false,
      isUser: true,
    };
    assert.throws(() => mw.requireAdmin(ctx));
  });

  test("extractToken from Authorization header", () => {
    const mw = createAuthMiddleware({
      jwtValidator: mockValidator(userIdentity),
    });
    const token = mw.extractToken({ authorization: "Bearer my-jwt-token" });
    assert.strictEqual(token, "my-jwt-token");
  });

  test("extractToken returns undefined for missing header", () => {
    const mw = createAuthMiddleware({
      jwtValidator: mockValidator(userIdentity),
    });
    const token = mw.extractToken({});
    assert.strictEqual(token, undefined);
  });
});
