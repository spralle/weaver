import test from "node:test";
import assert from "node:assert/strict";
import { evaluateChangePolicy } from "../dist/index.js";
import { withAuth } from "../../config-auth/dist/auth.js";
import { defineWeaver, Layers } from "@weaver/config-types";

// --- Test WeaverConfig and AuthConfig for canWrite injection ---

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

// Helpers — minimal context and schema builders
function makeContext(overrides = {}) {
  return {
    userId: "u1",
    tenantId: "t1",
    roles: ["platform-ops"],
    ...overrides,
  };
}

function makeSchema(overrides = {}) {
  return { type: "string", ...overrides };
}

// --- Tests ---

test("direct-allowed policy returns allowed", () => {
  const result = evaluateChangePolicy(
    makeSchema({ changePolicy: "direct-allowed" }),
    makeContext(),
    "app",
    testAuth.canWrite,
  );
  assert.deepEqual(result, { outcome: "allowed" });
});

test("staging-gate policy returns requires-promotion", () => {
  const result = evaluateChangePolicy(
    makeSchema({ changePolicy: "staging-gate" }),
    makeContext(),
    "app",
    testAuth.canWrite,
  );
  assert.equal(result.outcome, "requires-promotion");
  assert.ok(result.message.includes("staging"));
});

test("full-pipeline policy returns requires-promotion", () => {
  const result = evaluateChangePolicy(
    makeSchema({ changePolicy: "full-pipeline" }),
    makeContext(),
    "app",
    testAuth.canWrite,
  );
  assert.equal(result.outcome, "requires-promotion");
  assert.ok(result.message.includes("CI/CD"));
});

test("emergency-override without session flag returns requires-emergency-auth", () => {
  const result = evaluateChangePolicy(
    makeSchema({ changePolicy: "emergency-override" }),
    makeContext(), // no sessionMode
    "app",
    testAuth.canWrite,
  );
  assert.equal(result.outcome, "requires-emergency-auth");
  assert.ok(result.message.includes("emergency"));
});

test("emergency-override with session flag and reason returns allowed", () => {
  const result = evaluateChangePolicy(
    makeSchema({ changePolicy: "emergency-override" }),
    makeContext({
      sessionMode: "emergency-override",
      overrideReason: "Production incident #1234",
    }),
    "app",
    testAuth.canWrite,
  );
  assert.deepEqual(result, { outcome: "allowed" });
});

test("canWrite denied returns denied outcome", () => {
  // user role cannot write to core layer
  const result = evaluateChangePolicy(
    makeSchema({ changePolicy: "direct-allowed" }),
    makeContext({ roles: ["user"] }),
    "core",
    testAuth.canWrite,
  );
  assert.equal(result.outcome, "denied");
  assert.ok(result.reason.includes("denied"));
});

test("missing changePolicy defaults to direct-allowed", () => {
  const result = evaluateChangePolicy(
    makeSchema(), // no changePolicy field
    makeContext(),
    "app",
    testAuth.canWrite,
  );
  assert.deepEqual(result, { outcome: "allowed" });
});

test("emergency-override without reason returns requires-emergency-auth", () => {
  const result = evaluateChangePolicy(
    makeSchema({ changePolicy: "emergency-override" }),
    makeContext({ sessionMode: "emergency-override" }), // no overrideReason
    "app",
    testAuth.canWrite,
  );
  assert.equal(result.outcome, "requires-emergency-auth");
});

test("emergency-override with empty reason returns requires-emergency-auth", () => {
  const result = evaluateChangePolicy(
    makeSchema({ changePolicy: "emergency-override" }),
    makeContext({ sessionMode: "emergency-override", overrideReason: "" }),
    "app",
    testAuth.canWrite,
  );
  assert.equal(result.outcome, "requires-emergency-auth");
});
