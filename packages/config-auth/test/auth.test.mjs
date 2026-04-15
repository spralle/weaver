import test from "node:test";
import assert from "node:assert/strict";
import { withAuth } from "../dist/auth.js";
import { defineWeaver, Layers } from "@weaver/config-types";

// --- Test WeaverConfig and AuthConfig ---

const testConfig = defineWeaver([
  Layers.Static("core"),
  Layers.Static("app"),
  Layers.Static("module"),
  Layers.Static("integrator"),
  Layers.Static("tenant"),
  Layers.Static("user"),
  Layers.Static("device"),
  Layers.Ephemeral("session"),
]);

const testAuth = withAuth({
  weaverConfig: testConfig,
  visibilityRoles: {
    admin: new Set(["tenant-admin", "platform-ops", "support"]),
    platform: new Set(["platform-ops"]),
  },
  layerWritePolicies: [
    { layer: "core", allowedRoles: ["system"] },
    { layer: "app", allowedRoles: ["platform-ops", "system"] },
    { layer: "module", allowedRoles: ["system"] },
    { layer: "integrator", allowedRoles: ["platform-ops", "integrator"] },
    { layer: "tenant", allowedRoles: ["platform-ops", "tenant-admin"] },
    { layer: "user", allowedRoles: ["user", "platform-ops", "support"] },
    { layer: "device", allowedRoles: ["user"] },
    { layer: "session", allowedRoles: ["platform-ops", "support"] },
  ],
  dynamicScopeRoles: new Set(["scope-admin", "tenant-admin", "platform-ops"]),
  sessionLayer: "session",
  elevatedSessionMode: "god-mode",
});

// --- canRead tests ---

test("canRead: public visibility allows all roles", () => {
  const ctx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  assert.equal(testAuth.canRead(ctx, "ghost.app.theme", { type: "string", visibility: "public" }), true);
});

test("canRead: no schema allows read", () => {
  const ctx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  assert.equal(testAuth.canRead(ctx, "ghost.app.theme", undefined), true);
});

test("canRead: missing visibility defaults to public", () => {
  const ctx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  assert.equal(testAuth.canRead(ctx, "ghost.app.theme", { type: "string" }), true);
});

test("canRead: admin visibility requires admin+ roles", () => {
  const adminCtx = { userId: "u1", tenantId: "t1", roles: ["tenant-admin"] };
  const userCtx = { userId: "u2", tenantId: "t1", roles: ["user"] };
  const opsCtx = { userId: "u3", tenantId: "t1", roles: ["platform-ops"] };
  const supportCtx = { userId: "u4", tenantId: "t1", roles: ["support"] };

  const schema = { type: "string", visibility: "admin" };
  assert.equal(testAuth.canRead(adminCtx, "k", schema), true);
  assert.equal(testAuth.canRead(opsCtx, "k", schema), true);
  assert.equal(testAuth.canRead(supportCtx, "k", schema), true);
  assert.equal(testAuth.canRead(userCtx, "k", schema), false);
});

test("canRead: platform visibility requires platform-ops", () => {
  const opsCtx = { userId: "u1", tenantId: "t1", roles: ["platform-ops"] };
  const adminCtx = { userId: "u2", tenantId: "t1", roles: ["tenant-admin"] };
  const schema = { type: "string", visibility: "platform" };
  assert.equal(testAuth.canRead(opsCtx, "k", schema), true);
  assert.equal(testAuth.canRead(adminCtx, "k", schema), false);
});

test("canRead: internal visibility denies all", () => {
  const opsCtx = { userId: "u1", tenantId: "t1", roles: ["platform-ops"] };
  const schema = { type: "string", visibility: "internal" };
  assert.equal(testAuth.canRead(opsCtx, "k", schema), false);
});

// --- canWrite tests ---

test("canWrite: respects layer write policies", () => {
  // core layer only allows "system"
  const systemCtx = { userId: "u1", tenantId: "t1", roles: ["system"] };
  const userCtx = { userId: "u2", tenantId: "t1", roles: ["user"] };
  assert.equal(testAuth.canWrite(systemCtx, "core", "k", undefined), true);
  assert.equal(testAuth.canWrite(userCtx, "core", "k", undefined), false);
});

test("canWrite: user can write to user layer", () => {
  const userCtx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  assert.equal(testAuth.canWrite(userCtx, "user", "k", undefined), true);
});

test("canWrite: respects key writeRestriction", () => {
  const adminCtx = { userId: "u1", tenantId: "t1", roles: ["tenant-admin"] };
  const userCtx = { userId: "u2", tenantId: "t1", roles: ["user"] };
  const schema = {
    type: "string",
    writeRestriction: ["platform-ops"],
  };
  // tenant-admin can write to tenant layer, but writeRestriction blocks them
  assert.equal(testAuth.canWrite(adminCtx, "tenant", "k", schema), false);
  // user can't even write to tenant layer
  assert.equal(testAuth.canWrite(userCtx, "tenant", "k", schema), false);
});

test("canWrite: respects maxOverrideLayer ceiling", () => {
  const userCtx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  const schema = {
    type: "number",
    maxOverrideLayer: "tenant",
  };
  // user layer is above tenant, should be denied
  assert.equal(testAuth.canWrite(userCtx, "user", "k", schema), false);
});

test("canWrite: emergency override bypasses ceiling", () => {
  const userCtx = {
    userId: "u1",
    tenantId: "t1",
    roles: ["user"],
    sessionMode: "emergency-override",
  };
  const schema = {
    type: "number",
    maxOverrideLayer: "tenant",
  };
  // emergency override should bypass the ceiling
  assert.equal(testAuth.canWrite(userCtx, "user", "k", schema), true);
});

test("canWrite: dynamic scope layers allow scope-admin", () => {
  const scopeAdminCtx = { userId: "u1", tenantId: "t1", roles: ["scope-admin"] };
  assert.equal(testAuth.canWrite(scopeAdminCtx, "country:NO", "k", undefined), true);
});

test("canWrite: dynamic scope layers deny regular user", () => {
  const userCtx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  assert.equal(testAuth.canWrite(userCtx, "country:NO", "k", undefined), false);
});

// --- filterVisibleKeys tests ---

test("filterVisibleKeys: returns only readable keys", () => {
  const ctx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  const entries = {
    "ghost.app.theme": "dark",
    "ghost.app.secret": "hidden",
    "ghost.app.visible": true,
  };
  const schemaMap = new Map([
    ["ghost.app.theme", { type: "string", visibility: "public" }],
    ["ghost.app.secret", { type: "string", visibility: "internal" }],
    ["ghost.app.visible", { type: "boolean", visibility: "public" }],
  ]);

  const result = testAuth.filterVisibleKeys(ctx, entries, schemaMap);
  assert.ok("ghost.app.theme" in result);
  assert.ok(!("ghost.app.secret" in result));
  assert.ok("ghost.app.visible" in result);
  assert.equal(Object.keys(result).length, 2);
});

test("filterVisibleKeys: keys without schema are visible", () => {
  const ctx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  const entries = { "ghost.app.unknown": "value" };
  const schemaMap = new Map();

  const result = testAuth.filterVisibleKeys(ctx, entries, schemaMap);
  assert.ok("ghost.app.unknown" in result);
});

// --- session-mode tests (moved from config-engine) ---

// Helpers — session layer requires platform-ops or support role
const sessionCtx = (overrides = {}) => ({
  userId: "u1",
  tenantId: "t1",
  roles: ["platform-ops"],
  ...overrides,
});

const godModeCtx = (overrides = {}) => ({
  userId: "u1",
  tenantId: "t1",
  roles: ["platform-ops"],
  sessionMode: "god-mode",
  ...overrides,
});

test("session-mode: allowed (explicit) permits session layer write", () => {
  const schema = { type: "string", sessionMode: "allowed" };
  assert.equal(testAuth.canWrite(sessionCtx(), "session", "ghost.app.theme", schema), true);
});

test("session-mode: undefined (default) permits session layer write", () => {
  const schema = { type: "string" };
  assert.equal(testAuth.canWrite(sessionCtx(), "session", "ghost.app.theme", schema), true);
});

test("session-mode: no schema permits session layer write", () => {
  assert.equal(testAuth.canWrite(sessionCtx(), "session", "ghost.app.theme", undefined), true);
});

test("session-mode: blocked rejects session layer write unconditionally", () => {
  const schema = { type: "string", sessionMode: "blocked" };
  assert.equal(testAuth.canWrite(sessionCtx(), "session", "ghost.app.theme", schema), false);
});

test("session-mode: blocked rejects even with god-mode", () => {
  const schema = { type: "string", sessionMode: "blocked" };
  assert.equal(testAuth.canWrite(godModeCtx(), "session", "ghost.app.theme", schema), false);
});

test("session-mode: restricted rejects session write without god-mode", () => {
  const schema = { type: "string", sessionMode: "restricted" };
  assert.equal(testAuth.canWrite(sessionCtx(), "session", "ghost.app.theme", schema), false);
});

test("session-mode: restricted allows session write with god-mode", () => {
  const schema = { type: "string", sessionMode: "restricted" };
  assert.equal(testAuth.canWrite(godModeCtx(), "session", "ghost.app.theme", schema), true);
});

test("session-mode: restricted rejects with non-god-mode session type", () => {
  const schema = { type: "string", sessionMode: "restricted" };
  const ctx = sessionCtx({ sessionMode: "debug" });
  assert.equal(testAuth.canWrite(ctx, "session", "ghost.app.theme", schema), false);
});

test("session-mode: blocked key can still be written to tenant layer", () => {
  const schema = { type: "string", sessionMode: "blocked" };
  const ctx = { userId: "u1", tenantId: "t1", roles: ["tenant-admin"] };
  assert.equal(testAuth.canWrite(ctx, "tenant", "ghost.app.theme", schema), true);
});

test("session-mode: restricted key can be written to user layer without god-mode", () => {
  const schema = { type: "string", sessionMode: "restricted" };
  const ctx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  assert.equal(testAuth.canWrite(ctx, "user", "ghost.app.theme", schema), true);
});

test("session-mode: existing layer policy still works", () => {
  const systemCtx = { userId: "u1", tenantId: "t1", roles: ["system"] };
  const userCtx = { userId: "u2", tenantId: "t1", roles: ["user"] };
  assert.equal(testAuth.canWrite(systemCtx, "core", "k", undefined), true);
  assert.equal(testAuth.canWrite(userCtx, "core", "k", undefined), false);
});

test("session-mode: writeRestriction still works at session layer", () => {
  const ctx = sessionCtx();
  const schema = { type: "string", writeRestriction: ["tenant-admin"] };
  // platform-ops has session layer access but not writeRestriction role
  assert.equal(testAuth.canWrite(ctx, "session", "k", schema), false);
});

test("session-mode: maxOverrideLayer still works", () => {
  const userCtx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  const schema = { type: "number", maxOverrideLayer: "tenant" };
  assert.equal(testAuth.canWrite(userCtx, "user", "k", schema), false);
});
