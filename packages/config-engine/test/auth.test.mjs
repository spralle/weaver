import test from "node:test";
import assert from "node:assert/strict";
import { canRead, canWrite, filterVisibleKeys } from "../dist/index.js";

// --- canRead tests ---

test("canRead: public visibility allows all roles", () => {
  const ctx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  assert.equal(canRead(ctx, "ghost.app.theme", { type: "string", visibility: "public" }), true);
});

test("canRead: no schema allows read", () => {
  const ctx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  assert.equal(canRead(ctx, "ghost.app.theme", undefined), true);
});

test("canRead: missing visibility defaults to public", () => {
  const ctx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  assert.equal(canRead(ctx, "ghost.app.theme", { type: "string" }), true);
});

test("canRead: admin visibility requires admin+ roles", () => {
  const adminCtx = { userId: "u1", tenantId: "t1", roles: ["tenant-admin"] };
  const userCtx = { userId: "u2", tenantId: "t1", roles: ["user"] };
  const opsCtx = { userId: "u3", tenantId: "t1", roles: ["platform-ops"] };
  const supportCtx = { userId: "u4", tenantId: "t1", roles: ["support"] };

  const schema = { type: "string", visibility: "admin" };
  assert.equal(canRead(adminCtx, "k", schema), true);
  assert.equal(canRead(opsCtx, "k", schema), true);
  assert.equal(canRead(supportCtx, "k", schema), true);
  assert.equal(canRead(userCtx, "k", schema), false);
});

test("canRead: platform visibility requires platform-ops", () => {
  const opsCtx = { userId: "u1", tenantId: "t1", roles: ["platform-ops"] };
  const adminCtx = { userId: "u2", tenantId: "t1", roles: ["tenant-admin"] };
  const schema = { type: "string", visibility: "platform" };
  assert.equal(canRead(opsCtx, "k", schema), true);
  assert.equal(canRead(adminCtx, "k", schema), false);
});

test("canRead: internal visibility denies all", () => {
  const opsCtx = { userId: "u1", tenantId: "t1", roles: ["platform-ops"] };
  const schema = { type: "string", visibility: "internal" };
  assert.equal(canRead(opsCtx, "k", schema), false);
});

// --- canWrite tests ---

test("canWrite: respects layer write policies", () => {
  // core layer only allows "system"
  const systemCtx = { userId: "u1", tenantId: "t1", roles: ["system"] };
  const userCtx = { userId: "u2", tenantId: "t1", roles: ["user"] };
  assert.equal(canWrite(systemCtx, "core", "k", undefined), true);
  assert.equal(canWrite(userCtx, "core", "k", undefined), false);
});

test("canWrite: user can write to user layer", () => {
  const userCtx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  assert.equal(canWrite(userCtx, "user", "k", undefined), true);
});

test("canWrite: respects key writeRestriction", () => {
  const adminCtx = { userId: "u1", tenantId: "t1", roles: ["tenant-admin"] };
  const userCtx = { userId: "u2", tenantId: "t1", roles: ["user"] };
  const schema = {
    type: "string",
    writeRestriction: ["platform-ops"],
  };
  // tenant-admin can write to tenant layer, but writeRestriction blocks them
  assert.equal(canWrite(adminCtx, "tenant", "k", schema), false);
  // user can't even write to tenant layer
  assert.equal(canWrite(userCtx, "tenant", "k", schema), false);
});

test("canWrite: respects maxOverrideLayer ceiling", () => {
  const userCtx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  const schema = {
    type: "number",
    maxOverrideLayer: "tenant",
  };
  // user layer is above tenant, should be denied
  assert.equal(canWrite(userCtx, "user", "k", schema), false);
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
  assert.equal(canWrite(userCtx, "user", "k", schema), true);
});

test("canWrite: dynamic scope layers allow scope-admin", () => {
  const scopeAdminCtx = { userId: "u1", tenantId: "t1", roles: ["scope-admin"] };
  assert.equal(canWrite(scopeAdminCtx, "country:NO", "k", undefined), true);
});

test("canWrite: dynamic scope layers deny regular user", () => {
  const userCtx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  assert.equal(canWrite(userCtx, "country:NO", "k", undefined), false);
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

  const result = filterVisibleKeys(ctx, entries, schemaMap);
  assert.ok("ghost.app.theme" in result);
  assert.ok(!("ghost.app.secret" in result));
  assert.ok("ghost.app.visible" in result);
  assert.equal(Object.keys(result).length, 2);
});

test("filterVisibleKeys: keys without schema are visible", () => {
  const ctx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  const entries = { "ghost.app.unknown": "value" };
  const schemaMap = new Map();

  const result = filterVisibleKeys(ctx, entries, schemaMap);
  assert.ok("ghost.app.unknown" in result);
});
