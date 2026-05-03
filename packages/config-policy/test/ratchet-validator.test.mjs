import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES,
  validateOneWayRatchet,
} from "../dist/index.js";

const testLayerOrder = ["core","app","module","integrator","scope","user","device","session"];

test("reports violation when higher-priority layer loosens policy", () => {
  const result = validateOneWayRatchet(
    [
      { layer: "core", values: { changePolicy: "full-pipeline" } },
      { layer: "scope", values: { changePolicy: "staging-gate" } },
    ],
    DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES,
    { layerOrder: testLayerOrder },
  );

  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].field, "changePolicy");
  assert.equal(result.violations[0].transition, "loosened");
});

test("allows equal and tightening transitions", () => {
  const result = validateOneWayRatchet(
    [
      {
        layer: "core",
        values: {
          changePolicy: "direct-allowed",
          visibility: "admin",
        },
      },
      {
        layer: "scope",
        values: {
          changePolicy: "staging-gate",
          visibility: "admin",
        },
      },
      {
        layer: "user",
        values: {
          changePolicy: "full-pipeline",
          visibility: "platform",
        },
      },
    ],
    DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES,
    { layerOrder: testLayerOrder },
  );

  assert.equal(result.violations.length, 0);
  assert.equal(result.blocked.length, 0);

  const transitions = result.evaluations
    .filter((entry) => entry.field === "changePolicy")
    .map((entry) => entry.transition);
  assert.deepEqual(transitions, ["tightened", "tightened"]);
});

test("handles ordering gaps by comparing nearest defined values", () => {
  const result = validateOneWayRatchet(
    [
      { layer: "core", values: { changePolicy: "direct-allowed" } },
      { layer: "app", values: {} },
      { layer: "scope", values: { changePolicy: "staging-gate" } },
      { layer: "user", values: {} },
      { layer: "session", values: { changePolicy: "full-pipeline" } },
    ],
    DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES,
    { layerOrder: testLayerOrder },
  );

  assert.equal(result.violations.length, 0);
  const changePolicyEvaluations = result.evaluations.filter(
    (entry) => entry.field === "changePolicy",
  );
  assert.equal(changePolicyEvaluations.length, 2);
  assert.equal(changePolicyEvaluations[0].fromLayer, "core");
  assert.equal(changePolicyEvaluations[0].toLayer, "scope");
  assert.equal(changePolicyEvaluations[1].fromLayer, "scope");
  assert.equal(changePolicyEvaluations[1].toLayer, "session");
});

test("blocked semantics are sticky by default", () => {
  const result = validateOneWayRatchet(
    [
      { layer: "core", values: { changePolicy: "direct-allowed" } },
      { layer: "scope", values: { changePolicy: "unknown-policy" } },
      { layer: "user", values: { changePolicy: "full-pipeline" } },
    ],
    DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES,
    { layerOrder: testLayerOrder },
  );

  const changePolicyEvaluations = result.evaluations.filter(
    (entry) => entry.field === "changePolicy",
  );
  assert.equal(changePolicyEvaluations.length, 2);
  assert.equal(changePolicyEvaluations[0].transition, "blocked");
  assert.equal(changePolicyEvaluations[1].transition, "blocked");
  assert.equal(result.blocked.length, 2);
});

test("blocked semantics can be non-sticky when configured", () => {
  const result = validateOneWayRatchet(
    [
      { layer: "core", values: { changePolicy: "direct-allowed" } },
      { layer: "scope", values: { changePolicy: "unknown-policy" } },
      { layer: "user", values: { changePolicy: "full-pipeline" } },
    ],
    DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES,
    { layerOrder: testLayerOrder, stickyBlocked: false },
  );

  const changePolicyEvaluations = result.evaluations.filter(
    (entry) => entry.field === "changePolicy",
  );
  assert.equal(changePolicyEvaluations.length, 2);
  assert.equal(changePolicyEvaluations[0].transition, "blocked");
  assert.equal(changePolicyEvaluations[1].transition, "tightened");
  assert.equal(changePolicyEvaluations[1].fromLayer, "core");
  assert.equal(changePolicyEvaluations[1].toLayer, "user");
  assert.equal(result.blocked.length, 1);
});

test("maxOverrideLayer default rule enforces tighter ceiling", () => {
  const result = validateOneWayRatchet(
    [
      { layer: "core", values: { maxOverrideLayer: "scope" } },
      { layer: "scope", values: { maxOverrideLayer: "core" } },
      { layer: "user", values: { maxOverrideLayer: "scope" } },
    ],
    DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES,
    { layerOrder: testLayerOrder },
  );

  const maxOverrideEvaluations = result.evaluations.filter(
    (entry) => entry.field === "maxOverrideLayer",
  );
  assert.equal(maxOverrideEvaluations[0].transition, "tightened");
  assert.equal(maxOverrideEvaluations[1].transition, "loosened");
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].field, "maxOverrideLayer");
});
