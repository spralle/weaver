import { describe, expect, test } from "bun:test";
import { createAuthMiddleware } from "../../src/auth/auth-middleware.js";
import type {
  JwtIdentity,
  JwtValidator,
} from "../../src/auth/jwt-validator.js";

function mockValidator(identity: JwtIdentity): JwtValidator {
  return {
    async validate(_token: string): Promise<JwtIdentity> {
      return identity;
    },
  };
}

function failingValidator(error: unknown): JwtValidator {
  return {
    async validate(_token: string): Promise<JwtIdentity> {
      throw error;
    },
  };
}

describe("AuthMiddleware", () => {
  const userIdentity: JwtIdentity = {
    userId: "user-42",
    roles: ["editor"],
    claims: { sub: "user-42", roles: ["editor"] },
  };

  const serviceIdentity: JwtIdentity = {
    serviceId: "svc-deploy",
    claims: { serviceId: "svc-deploy" },
  };

  const adminIdentity: JwtIdentity = {
    userId: "admin-1",
    roles: ["admin"],
    claims: { sub: "admin-1", roles: ["admin"] },
  };

  test("authenticate with valid token returns AuthContext", async () => {
    const mw = createAuthMiddleware({
      jwtValidator: mockValidator(userIdentity),
    });
    const ctx = await mw.authenticate("valid-token");
    expect(ctx.identity.userId).toBe("user-42");
    expect(ctx.isUser).toBe(true);
    expect(ctx.isService).toBe(false);
    expect(ctx.isAdmin).toBe(false);
  });

  test("authenticate with missing token throws UNAUTHORIZED", async () => {
    const mw = createAuthMiddleware({
      jwtValidator: mockValidator(userIdentity),
    });
    await expect(mw.authenticate(undefined)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("authenticate with invalid token throws UNAUTHORIZED", async () => {
    const mw = createAuthMiddleware({
      jwtValidator: failingValidator({
        code: "UNAUTHORIZED",
        message: "Invalid signature",
      }),
    });
    await expect(mw.authenticate("bad-token")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("isService=true for M2M tokens", async () => {
    const mw = createAuthMiddleware({
      jwtValidator: mockValidator(serviceIdentity),
    });
    const ctx = await mw.authenticate("svc-token");
    expect(ctx.isService).toBe(true);
    expect(ctx.isAdmin).toBe(true); // services are admin
    expect(ctx.isUser).toBe(false);
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
    expect(() => mw.requireAdmin(ctx)).not.toThrow();
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
    expect(() => mw.requireAdmin(ctx)).toThrow();
  });

  test("extractToken from Authorization header", () => {
    const mw = createAuthMiddleware({
      jwtValidator: mockValidator(userIdentity),
    });
    const token = mw.extractToken({ authorization: "Bearer my-jwt-token" });
    expect(token).toBe("my-jwt-token");
  });

  test("extractToken returns undefined for missing header", () => {
    const mw = createAuthMiddleware({
      jwtValidator: mockValidator(userIdentity),
    });
    const token = mw.extractToken({});
    expect(token).toBeUndefined();
  });
});
