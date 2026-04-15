import test from "node:test";
import assert from "node:assert/strict";
import { evaluateChangePolicy } from "../dist/index.js";

const testLayers = ["core","app","module","integrator","tenant","user","device","session"];
const getRank = (l) => { const i = testLayers.indexOf(l); return i >= 0 ? i : testLayers.length; };

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
    getRank,
  );
  assert.deepEqual(result, { outcome: "allowed" });
});

test("staging-gate policy returns requires-promotion", () => {
  const result = evaluateChangePolicy(
    makeSchema({ changePolicy: "staging-gate" }),
    makeContext(),
    "app",
    getRank,
  );
  assert.equal(result.outcome, "requires-promotion");
  assert.ok(result.message.includes("staging"));
});

test("full-pipeline policy returns requires-promotion", () => {
  const result = evaluateChangePolicy(
    makeSchema({ changePolicy: "full-pipeline" }),
    makeContext(),
    "app",
    getRank,
  );
  assert.equal(result.outcome, "requires-promotion");
  assert.ok(result.message.includes("CI/CD"));
});

test("emergency-override without session flag returns requires-emergency-auth", () => {
  const result = evaluateChangePolicy(
    makeSchema({ changePolicy: "emergency-override" }),
    makeContext(), // no sessionMode
    "app",
    getRank,
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
    getRank,
  );
  assert.deepEqual(result, { outcome: "allowed" });
});

test("canWrite denied returns denied outcome", () => {
  // user role cannot write to core layer
  const result = evaluateChangePolicy(
    makeSchema({ changePolicy: "direct-allowed" }),
    makeContext({ roles: ["user"] }),
    "core",
    getRank,
  );
  assert.equal(result.outcome, "denied");
  assert.ok(result.reason.includes("denied"));
});

test("missing changePolicy defaults to direct-allowed", () => {
  const result = evaluateChangePolicy(
    makeSchema(), // no changePolicy field
    makeContext(),
    "app",
    getRank,
  );
  assert.deepEqual(result, { outcome: "allowed" });
});

test("emergency-override without reason returns requires-emergency-auth", () => {
  const result = evaluateChangePolicy(
    makeSchema({ changePolicy: "emergency-override" }),
    makeContext({ sessionMode: "emergency-override" }), // no overrideReason
    "app",
    getRank,
  );
  assert.equal(result.outcome, "requires-emergency-auth");
});

test("emergency-override with empty reason returns requires-emergency-auth", () => {
  const result = evaluateChangePolicy(
    makeSchema({ changePolicy: "emergency-override" }),
    makeContext({ sessionMode: "emergency-override", overrideReason: "" }),
    "app",
    getRank,
  );
  assert.equal(result.outcome, "requires-emergency-auth");
});
