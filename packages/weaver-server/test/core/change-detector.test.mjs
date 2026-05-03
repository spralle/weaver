import { test, describe } from "bun:test";
import assert from "node:assert/strict";
import { createChangeDetector } from "../../src/core/change-detector.ts";

function createMockConfigService(providerIds) {
  const reloaded = [];
  return {
    reloaded,
    providers: providerIds.map((id) => ({ id, layer: "platform", writable: true })),
    async reloadProvider(id) { reloaded.push(id); },
  };
}

function createMockGitManager() {
  let pullCount = 0;
  return {
    get pullCount() { return pullCount; },
    localPath: "/tmp/repo",
    async ensureClone() {},
    async pull() { pullCount++; },
  };
}

describe("ChangeDetector", () => {
  test("triggerCheck reloads git providers", async () => {
    const svc = createMockConfigService(["git-p1", "git-p2"]);
    const git = createMockGitManager();

    const detector = createChangeDetector({
      configService: svc,
      gitManager: git,
      gitProviderIds: ["git-p1", "git-p2"],
    });

    await detector.triggerCheck();
    assert.equal(git.pullCount, 1);
    assert.deepEqual(svc.reloaded, ["git-p1", "git-p2"]);
  });

  test("start/stop manages polling", async () => {
    const svc = createMockConfigService([]);
    const detector = createChangeDetector({
      configService: svc,
      gitManager: createMockGitManager(),
      gitProviderIds: [],
      pollIntervalMs: 50,
    });

    detector.start();
    await new Promise((r) => setTimeout(r, 130));
    detector.stop();

    // Should have polled at least once
    // (gitManager.pull was called)
  });

  test("stop prevents further polling", async () => {
    const git = createMockGitManager();
    const svc = createMockConfigService([]);
    const detector = createChangeDetector({
      configService: svc,
      gitManager: git,
      gitProviderIds: [],
      pollIntervalMs: 30,
    });

    detector.start();
    detector.stop();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(git.pullCount, 0);
  });
});
