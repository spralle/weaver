import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createChangeDetector } from "../../src/core/change-detector.ts";

function createMockConfigService() {
  let refreshCount = 0;
  return {
    get refreshCount() { return refreshCount; },
    providers: [],
    async refreshProviders() { refreshCount++; },
  };
}

describe("ChangeDetector", () => {
  test("triggerCheck calls configService.refreshProviders", async () => {
    const svc = createMockConfigService();

    const detector = createChangeDetector({
      configService: svc,
    });

    await detector.triggerCheck();
    assert.equal(svc.refreshCount, 1);
  });

  test("start/stop manages polling", async () => {
    const svc = createMockConfigService();
    const detector = createChangeDetector({
      configService: svc,
      pollIntervalMs: 50,
    });

    detector.start();
    await new Promise((r) => setTimeout(r, 130));
    detector.stop();

    // Should have polled at least once
    assert.ok(svc.refreshCount >= 1);
  });

  test("stop prevents further polling", async () => {
    const svc = createMockConfigService();
    const detector = createChangeDetector({
      configService: svc,
      pollIntervalMs: 30,
    });

    detector.start();
    detector.stop();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(svc.refreshCount, 0);
  });
});
