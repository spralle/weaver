import test from "node:test";
import assert from "node:assert/strict";
import { canWrite } from "../dist/index.js";

const testLayers = ["core","app","module","integrator","tenant","user","device","session"];
const getRank = (l) => { const i = testLayers.indexOf(l); return i >= 0 ? i : testLayers.length; };

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

// --- sessionMode: "allowed" (or undefined) ---

test("session-mode: allowed (explicit) permits session layer write", () => {
  const schema = { type: "string", sessionMode: "allowed" };
  assert.equal(canWrite(sessionCtx(), "session", "ghost.app.theme", schema, getRank), true);
});

test("session-mode: undefined (default) permits session layer write", () => {
  const schema = { type: "string" };
  assert.equal(canWrite(sessionCtx(), "session", "ghost.app.theme", schema, getRank), true);
});

test("session-mode: no schema permits session layer write", () => {
  assert.equal(canWrite(sessionCtx(), "session", "ghost.app.theme", undefined, getRank), true);
});

// --- sessionMode: "blocked" ---

test("session-mode: blocked rejects session layer write unconditionally", () => {
  const schema = { type: "string", sessionMode: "blocked" };
  assert.equal(canWrite(sessionCtx(), "session", "ghost.app.theme", schema, getRank), false);
});

test("session-mode: blocked rejects even with god-mode", () => {
  const schema = { type: "string", sessionMode: "blocked" };
  assert.equal(canWrite(godModeCtx(), "session", "ghost.app.theme", schema, getRank), false);
});

// --- sessionMode: "restricted" ---

test("session-mode: restricted rejects session write without god-mode", () => {
  const schema = { type: "string", sessionMode: "restricted" };
  assert.equal(canWrite(sessionCtx(), "session", "ghost.app.theme", schema, getRank), false);
});

test("session-mode: restricted allows session write with god-mode", () => {
  const schema = { type: "string", sessionMode: "restricted" };
  assert.equal(canWrite(godModeCtx(), "session", "ghost.app.theme", schema, getRank), true);
});

test("session-mode: restricted rejects with non-god-mode session type", () => {
  const schema = { type: "string", sessionMode: "restricted" };
  const ctx = sessionCtx({ sessionMode: "debug" });
  assert.equal(canWrite(ctx, "session", "ghost.app.theme", schema, getRank), false);
});

// --- sessionMode enforcement does NOT apply to non-session layers ---

test("session-mode: blocked key can still be written to tenant layer", () => {
  const schema = { type: "string", sessionMode: "blocked" };
  const ctx = { userId: "u1", tenantId: "t1", roles: ["tenant-admin"] };
  assert.equal(canWrite(ctx, "tenant", "ghost.app.theme", schema, getRank), true);
});

test("session-mode: restricted key can be written to user layer without god-mode", () => {
  const schema = { type: "string", sessionMode: "restricted" };
  const ctx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  assert.equal(canWrite(ctx, "user", "ghost.app.theme", schema, getRank), true);
});

// --- No regression: existing canWrite scenarios still pass ---

test("session-mode: existing layer policy still works", () => {
  const systemCtx = { userId: "u1", tenantId: "t1", roles: ["system"] };
  const userCtx = { userId: "u2", tenantId: "t1", roles: ["user"] };
  assert.equal(canWrite(systemCtx, "core", "k", undefined, getRank), true);
  assert.equal(canWrite(userCtx, "core", "k", undefined, getRank), false);
});

test("session-mode: writeRestriction still works at session layer", () => {
  const ctx = sessionCtx();
  const schema = { type: "string", writeRestriction: ["tenant-admin"] };
  // platform-ops has session layer access but not writeRestriction role
  assert.equal(canWrite(ctx, "session", "k", schema, getRank), false);
});

test("session-mode: maxOverrideLayer still works", () => {
  const userCtx = { userId: "u1", tenantId: "t1", roles: ["user"] };
  const schema = { type: "number", maxOverrideLayer: "tenant" };
  assert.equal(canWrite(userCtx, "user", "k", schema, getRank), false);
});
