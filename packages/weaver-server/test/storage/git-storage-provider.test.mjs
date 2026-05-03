import { test } from "bun:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GitStorageProvider } from "../../src/storage/git-storage-provider.ts";

function createMockGitManager(localPath) {
  const calls = [];
  return {
    calls,
    localPath,
    async ensureClone() { calls.push(["ensureClone"]); },
    async pull() { calls.push(["pull"]); },
    async commitAndPush(message, files) { calls.push(["commitAndPush", message, files]); },
  };
}

test("load() delegates to FileSystemStorageProvider", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({ foo: "bar" }));

  const gitManager = createMockGitManager(tmp);

  const provider = new GitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  const data = await provider.load();
  assert.deepEqual(data.entries, { foo: "bar" });
});

test("write() is local-only — no git calls happen", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const gitManager = createMockGitManager(tmp);

  const provider = new GitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  const result = await provider.write("key1", "value1");
  assert.equal(result.success, true);
  assert.equal(gitManager.calls.length, 0);
});

test("write() marks provider as dirty", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const gitManager = createMockGitManager(tmp);

  const provider = new GitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  assert.equal(provider.dirty, false);
  await provider.write("key1", "value1");
  assert.equal(provider.dirty, true);
});

test("flush() calls gitManager.commitAndPush() with dirty files", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const gitManager = createMockGitManager(tmp);

  const provider = new GitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  await provider.write("key1", "value1");
  await provider.flush();

  assert.equal(gitManager.calls.length, 1);
  assert.equal(gitManager.calls[0][0], "commitAndPush");
  assert.equal(gitManager.calls[0][1], "config: set key1");
  assert.deepEqual(gitManager.calls[0][2], ["config.json"]);
  assert.equal(provider.dirty, false);
});

test("flush() on clean provider is no-op", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const gitManager = createMockGitManager(tmp);

  const provider = new GitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  await provider.flush();
  assert.equal(gitManager.calls.length, 0);
});

test("flush() builds batch commit message for multiple changes", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const gitManager = createMockGitManager(tmp);

  const provider = new GitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  await provider.write("a", 1);
  await provider.write("b", 2);
  await provider.flush();

  assert.equal(gitManager.calls[0][1], "config: 2 changes in defaults");
});

test("remove() is local-only, marks dirty", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({ key1: "val" }));

  const gitManager = createMockGitManager(tmp);

  const provider = new GitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  const result = await provider.remove("key1");
  assert.equal(result.success, true);
  assert.equal(provider.dirty, true);
  assert.equal(gitManager.calls.length, 0);
});

test("refresh() calls gitManager.pull()", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const gitManager = createMockGitManager(tmp);

  const provider = new GitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  await provider.refresh();
  assert.equal(gitManager.calls.length, 1);
  assert.deepEqual(gitManager.calls[0], ["pull"]);
});

test("read-only provider rejects writes", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const gitManager = createMockGitManager(tmp);

  const provider = new GitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
    writable: false,
  });

  const result = await provider.write("x", 1);
  assert.equal(result.success, false);
  assert.equal(gitManager.calls.length, 0);
});
