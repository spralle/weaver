import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withAuth } from "../src/auth.js";
import type { AuthConfig } from "../src/auth.js";
import { defineWeaver } from "@weaver/config-types";

const weaverConfig = defineWeaver([
  { name: "core", type: { id: "static" } },
  { name: "app", type: { id: "static" } },
  { name: "user", type: { id: "dynamic" } },
  { name: "session", type: { id: "ephemeral" } },
]);

const authConfig: AuthConfig = {
  weaverConfig,
  visibilityRoles: {
    admin: new Set(["admin"]),
    platform: new Set(["admin", "platform-eng"]),
  },
  layerWritePolicies: [
    { layer: "core", allowedRoles: ["admin"] },
    { layer: "app", allowedRoles: ["admin", "developer"] },
    { layer: "user", allowedRoles: ["admin", "user"] },
    { layer: "session", allowedRoles: ["admin", "user"] },
  ],
  dynamicScopeRoles: new Set(["admin"]),
  sessionLayer: "session",
  elevatedSessionMode: "god-mode",
};

describe("withAuth", () => {
  const auth = withAuth(authConfig);

  describe("canRead", () => {
    it("allows public visibility for any role", () => {
      const ctx = { userId: "u1", roles: ["user"] as const };
      assert.equal(auth.canRead(ctx, "k", { type: "string", "x-weaver": { visibility: "public" } }), true);
    });

    it("denies admin visibility without admin role", () => {
      const ctx = { userId: "u1", roles: ["user"] as const };
      assert.equal(auth.canRead(ctx, "k", { type: "string", "x-weaver": { visibility: "admin" } }), false);
    });

    it("allows admin visibility with admin role", () => {
      const ctx = { userId: "u1", roles: ["admin"] as const };
      assert.equal(auth.canRead(ctx, "k", { type: "string", "x-weaver": { visibility: "admin" } }), true);
    });

    it("denies internal visibility always", () => {
      const ctx = { userId: "u1", roles: ["admin"] as const };
      assert.equal(auth.canRead(ctx, "k", { type: "string", "x-weaver": { visibility: "internal" } }), false);
    });
  });

  describe("canWrite", () => {
    it("denies write to layer without matching role", () => {
      const ctx = { userId: "u1", roles: ["user"] as const };
      assert.equal(auth.canWrite(ctx, "core", "k", undefined), false);
    });

    it("allows write to layer with matching role", () => {
      const ctx = { userId: "u1", roles: ["admin"] as const };
      assert.equal(auth.canWrite(ctx, "core", "k", undefined), true);
    });

    it("denies write when writeRestriction not met", () => {
      const ctx = { userId: "u1", roles: ["developer"] as const };
      const schema = { type: "string" as const, "x-weaver": { writeRestriction: ["admin"] } };
      assert.equal(auth.canWrite(ctx, "app", "k", schema), false);
    });

    it("blocks session write for blocked sessionMode property", () => {
      const ctx = { userId: "u1", roles: ["user"] as const };
      const schema = { type: "string" as const, "x-weaver": { sessionMode: "blocked" as const } };
      assert.equal(auth.canWrite(ctx, "session", "k", schema), false);
    });

    it("allows restricted sessionMode with elevated mode", () => {
      const ctx = { userId: "u1", roles: ["user"] as const, sessionMode: "god-mode" as const };
      const schema = { type: "string" as const, "x-weaver": { sessionMode: "restricted" as const } };
      assert.equal(auth.canWrite(ctx, "session", "k", schema), true);
    });
  });

  describe("filterVisibleKeys", () => {
    it("filters out keys the caller cannot read", () => {
      const ctx = { userId: "u1", roles: ["user"] as const };
      const entries = { pub: "yes", secret: "no" };
      const schemaMap = new Map([
        ["pub", { type: "string" as const, "x-weaver": { visibility: "public" as const } }],
        ["secret", { type: "string" as const, "x-weaver": { visibility: "internal" as const } }],
      ]);
      const result = auth.filterVisibleKeys(ctx, entries, schemaMap);
      assert.equal(result["pub"], "yes");
      assert.equal(result["secret"], undefined);
    });
  });
});
