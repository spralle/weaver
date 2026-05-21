import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateOneWayRatchet,
  DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES,
} from "../src/ratchet-validator.js";
import type { RatchetLayerSnapshot, RatchetRule } from "../src/ratchet-validator.js";

const layerOrder = ["core", "app", "module", "integrator", "scope", "user", "device", "session"];

describe("validateOneWayRatchet", () => {
  it("reports no violations when values tighten across layers", () => {
    const layers: RatchetLayerSnapshot[] = [
      { layer: "core", values: { changePolicy: "direct-allowed" } },
      { layer: "app", values: { changePolicy: "staging-gate" } },
    ];
    const result = validateOneWayRatchet(layers, DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES, { layerOrder });
    assert.equal(result.violations.length, 0);
    assert.equal(result.blocked.length, 0);
  });

  it("reports violation when value loosens", () => {
    const layers: RatchetLayerSnapshot[] = [
      { layer: "core", values: { changePolicy: "full-pipeline" } },
      { layer: "app", values: { changePolicy: "direct-allowed" } },
    ];
    const result = validateOneWayRatchet(layers, DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES, { layerOrder });
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0]!.transition, "loosened");
  });

  it("reports blocked for unknown values in ordered rule", () => {
    const layers: RatchetLayerSnapshot[] = [
      { layer: "core", values: { changePolicy: "unknown-policy" } },
      { layer: "app", values: { changePolicy: "direct-allowed" } },
    ];
    const result = validateOneWayRatchet(layers, DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES, { layerOrder });
    assert.equal(result.blocked.length, 1);
  });

  it("handles custom ratchet rules", () => {
    const customRule: RatchetRule = {
      kind: "custom",
      field: "maxRetries",
      compare: (prev, curr) => {
        if (typeof prev !== "number" || typeof curr !== "number") return "blocked";
        if (curr < prev) return "tightened";
        if (curr === prev) return "equal";
        return "loosened";
      },
    };
    const layers: RatchetLayerSnapshot[] = [
      { layer: "core", values: { maxRetries: 5 } },
      { layer: "app", values: { maxRetries: 3 } },
    ];
    const result = validateOneWayRatchet(layers, [customRule], { layerOrder });
    assert.equal(result.violations.length, 0);
    assert.equal(result.evaluations[0]!.transition, "tightened");
  });

  it("sticky blocked propagates to subsequent layers", () => {
    const layers: RatchetLayerSnapshot[] = [
      { layer: "core", values: { visibility: 123 as unknown as string } },
      { layer: "app", values: { visibility: "public" } },
      { layer: "module", values: { visibility: "admin" } },
    ];
    const result = validateOneWayRatchet(layers, DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES, {
      layerOrder,
      stickyBlocked: true,
    });
    assert.equal(result.blocked.length, 2);
  });

  it("equal transitions are not violations", () => {
    const layers: RatchetLayerSnapshot[] = [
      { layer: "core", values: { visibility: "admin" } },
      { layer: "app", values: { visibility: "admin" } },
    ];
    const result = validateOneWayRatchet(layers, DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES, { layerOrder });
    assert.equal(result.violations.length, 0);
    assert.equal(result.evaluations[0]!.transition, "equal");
  });
});
