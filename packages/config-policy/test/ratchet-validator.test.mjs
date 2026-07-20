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

  expect(result.violations.length).toBe(1);
  expect(result.violations[0].field).toBe("changePolicy");
  expect(result.violations[0].transition).toBe("loosened");
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

  expect(result.violations.length).toBe(0);
  expect(result.blocked.length).toBe(0);

  const transitions = result.evaluations
    .filter((entry) => entry.field === "changePolicy")
    .map((entry) => entry.transition);
  expect(transitions).toEqual(["tightened", "tightened"]);
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

  expect(result.violations.length).toBe(0);
  const changePolicyEvaluations = result.evaluations.filter(
    (entry) => entry.field === "changePolicy",
  );
  expect(changePolicyEvaluations.length).toBe(2);
  expect(changePolicyEvaluations[0].fromLayer).toBe("core");
  expect(changePolicyEvaluations[0].toLayer).toBe("scope");
  expect(changePolicyEvaluations[1].fromLayer).toBe("scope");
  expect(changePolicyEvaluations[1].toLayer).toBe("session");
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
  expect(changePolicyEvaluations.length).toBe(2);
  expect(changePolicyEvaluations[0].transition).toBe("blocked");
  expect(changePolicyEvaluations[1].transition).toBe("blocked");
  expect(result.blocked.length).toBe(2);
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
  expect(changePolicyEvaluations.length).toBe(2);
  expect(changePolicyEvaluations[0].transition).toBe("blocked");
  expect(changePolicyEvaluations[1].transition).toBe("tightened");
  expect(changePolicyEvaluations[1].fromLayer).toBe("core");
  expect(changePolicyEvaluations[1].toLayer).toBe("user");
  expect(result.blocked.length).toBe(1);
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
  expect(maxOverrideEvaluations[0].transition).toBe("tightened");
  expect(maxOverrideEvaluations[1].transition).toBe("loosened");
  expect(result.violations.length).toBe(1);
  expect(result.violations[0].field).toBe("maxOverrideLayer");
});
