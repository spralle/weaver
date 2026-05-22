import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConfigurationPropertySchema } from "@weaver-conf/config-types";
import type { PolicyEvaluationContext } from "../src/policy-engine.js";
import { evaluateChangePolicy } from "../src/policy-engine.js";

function makeSchema(changePolicy?: string): ConfigurationPropertySchema {
  return {
    type: "string",
    "x-weaver": { changePolicy } as never,
  };
}

function makeContext(
  overrides?: Partial<PolicyEvaluationContext>,
): PolicyEvaluationContext {
  return { userId: "u1", roles: ["admin"], ...overrides };
}

const allowWrite = () => true;
const denyWrite = () => false;

describe("evaluateChangePolicy", () => {
  it("denies when base write check fails", () => {
    const result = evaluateChangePolicy(
      makeSchema(),
      makeContext(),
      "app",
      denyWrite,
    );
    assert.equal(result.outcome, "denied");
  });

  it("allows direct-allowed policy", () => {
    const result = evaluateChangePolicy(
      makeSchema("direct-allowed"),
      makeContext(),
      "app",
      allowWrite,
    );
    assert.equal(result.outcome, "allowed");
  });

  it("defaults to direct-allowed when no policy set", () => {
    const schema: ConfigurationPropertySchema = { type: "string" };
    const result = evaluateChangePolicy(
      schema,
      makeContext(),
      "app",
      allowWrite,
    );
    assert.equal(result.outcome, "allowed");
  });

  it("requires promotion for staging-gate", () => {
    const result = evaluateChangePolicy(
      makeSchema("staging-gate"),
      makeContext(),
      "app",
      allowWrite,
    );
    assert.equal(result.outcome, "requires-promotion");
  });

  it("requires promotion for full-pipeline", () => {
    const result = evaluateChangePolicy(
      makeSchema("full-pipeline"),
      makeContext(),
      "app",
      allowWrite,
    );
    assert.equal(result.outcome, "requires-promotion");
  });

  it("requires emergency auth when no override reason", () => {
    const result = evaluateChangePolicy(
      makeSchema("emergency-override"),
      makeContext(),
      "app",
      allowWrite,
    );
    assert.equal(result.outcome, "requires-emergency-auth");
  });

  it("allows emergency-override with proper session and reason", () => {
    const ctx = makeContext({
      sessionMode: "emergency-override",
      overrideReason: "hotfix",
    });
    const result = evaluateChangePolicy(
      makeSchema("emergency-override"),
      ctx,
      "app",
      allowWrite,
    );
    assert.equal(result.outcome, "allowed");
  });

  it("denies emergency-override with empty reason", () => {
    const ctx = makeContext({
      sessionMode: "emergency-override",
      overrideReason: "",
    });
    const result = evaluateChangePolicy(
      makeSchema("emergency-override"),
      ctx,
      "app",
      allowWrite,
    );
    assert.equal(result.outcome, "requires-emergency-auth");
  });
});
