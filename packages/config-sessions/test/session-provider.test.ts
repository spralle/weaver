import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createOverrideSessionProvider } from "../src/override-session-provider.js";

function createTestProvider() {
  const audits: Array<{ action: string }> = [];
  const controller = createOverrideSessionProvider({
    defaultDurationMs: 10_000,
    onAudit: (entry) => audits.push({ action: entry.action }),
    timer: {
      setTimeout: () => 0,
      clearTimeout: () => {},
    },
  });
  return { controller, audits };
}

describe("OverrideSessionProvider", () => {
  it("activates a session", () => {
    const { controller } = createTestProvider();
    const session = controller.activate({ activatedBy: "admin", reason: "test" });
    assert.ok(session.id);
    assert.equal(session.activatedBy, "admin");
    assert.equal(session.isActive, true);
    assert.equal(controller.isActive(), true);
  });

  it("throws when activating while session already active", () => {
    const { controller } = createTestProvider();
    controller.activate({ activatedBy: "admin", reason: "test" });
    assert.throws(() => controller.activate({ activatedBy: "admin", reason: "again" }));
  });

  it("deactivates a session and clears overrides", () => {
    const { controller } = createTestProvider();
    controller.activate({ activatedBy: "admin", reason: "test" });
    const result = controller.deactivate();
    assert.ok(result.sessionId);
    assert.equal(result.overridesCleared, 0);
    assert.equal(controller.isActive(), false);
  });

  it("throws when deactivating with no active session", () => {
    const { controller } = createTestProvider();
    assert.throws(() => controller.deactivate());
  });

  it("extends a session", () => {
    const { controller } = createTestProvider();
    controller.activate({ activatedBy: "admin", reason: "test" });
    const extended = controller.extend(20_000);
    assert.ok(extended.expiresAt);
  });

  it("provider write/load tracks overrides", async () => {
    const { controller } = createTestProvider();
    controller.activate({ activatedBy: "admin", reason: "test" });
    const provider = controller.provider;
    await provider.write!("feature.x", true);
    const data = await provider.load();
    assert.equal(data.entries["feature.x"], true);
  });

  it("provider remove clears override", async () => {
    const { controller } = createTestProvider();
    controller.activate({ activatedBy: "admin", reason: "test" });
    await controller.provider.write!("k", "v");
    await controller.provider.remove!("k");
    const data = await controller.provider.load();
    assert.equal(data.entries["k"], undefined);
  });

  it("deactivate reports correct overridesCleared count", async () => {
    const { controller } = createTestProvider();
    controller.activate({ activatedBy: "admin", reason: "test" });
    await controller.provider.write!("a", 1);
    await controller.provider.write!("b", 2);
    const result = controller.deactivate();
    assert.equal(result.overridesCleared, 2);
  });

  it("emits audit events", () => {
    const { controller, audits } = createTestProvider();
    controller.activate({ activatedBy: "admin", reason: "test" });
    controller.extend();
    controller.deactivate();
    assert.deepEqual(audits.map((a) => a.action), ["activate", "extend", "deactivate"]);
  });

  it("dispose cleans up", () => {
    const { controller } = createTestProvider();
    controller.activate({ activatedBy: "admin", reason: "test" });
    controller.dispose();
    assert.equal(controller.isActive(), false);
  });
});
