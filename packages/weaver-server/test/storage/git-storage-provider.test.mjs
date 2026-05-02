import { test, describe } from "bun:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGitWriteQueue } from "../../src/git/write-queue.ts";
import { GitStorageProvider } from "../../src/storage/git-storage-provider.ts";

function createMockGit() {
  const calls = [];
  return {
    calls,
    cwd(path) { calls.push(["cwd", path]); return Promise.resolve(); },
    add(file) { calls.push(["add", file]); return Promise.resolve(); },
    commit(msg) { calls.push(["commit", msg]); return Promise.resolve(); },
    pull(args) { calls.push(["pull", args]); return Promise.resolve(); },
    push() { calls.push(["push"]); return Promise.resolve(); },
  };
}

test("load() delegates to FileSystemStorageProvider", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({ foo: "bar" }));

  const git = createMockGit();
  const queue = createGitWriteQueue();

  const provider = new GitStorageProvider({
    id: "test-git",
    layer: "defaults",
    repoPath: tmp,
    filePath: "config.json",
    writeQueue: queue,
    git,
  });

  const data = await provider.load();
  assert.deepEqual(data.entries, { foo: "bar" });
});

test("write() calls FSP then git add/commit/pull/push in order", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const git = createMockGit();
  const queue = createGitWriteQueue();

  const provider = new GitStorageProvider({
    id: "test-git",
    layer: "defaults",
    repoPath: tmp,
    filePath: "config.json",
    writeQueue: queue,
    git,
  });

  const result = await provider.write("key1", "value1");
  assert.equal(result.success, true);

  const ops = git.calls.map(c => c[0]);
  assert.deepEqual(ops, ["cwd", "add", "commit", "pull", "push"]);
  assert.equal(git.calls[1][1], "config.json");
  assert.equal(git.calls[2][1], "config: set key1");
});

test("remove() calls FSP then git add/commit/pull/push", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({ key1: "val" }));

  const git = createMockGit();
  const queue = createGitWriteQueue();

  const provider = new GitStorageProvider({
    id: "test-git",
    layer: "defaults",
    repoPath: tmp,
    filePath: "config.json",
    writeQueue: queue,
    git,
  });

  const result = await provider.remove("key1");
  assert.equal(result.success, true);

  const commitCall = git.calls.find(c => c[0] === "commit");
  assert.equal(commitCall[1], "config: remove key1");
});

test("writes are serialized through the queue", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const git = createMockGit();
  const queue = createGitWriteQueue();

  const provider = new GitStorageProvider({
    id: "test-git",
    layer: "defaults",
    repoPath: tmp,
    filePath: "config.json",
    writeQueue: queue,
    git,
  });

  const p1 = provider.write("a", 1);
  const p2 = provider.write("b", 2);
  await Promise.all([p1, p2]);

  // Both should have completed with git operations interleaved correctly
  const commitCalls = git.calls.filter(c => c[0] === "commit");
  assert.equal(commitCalls.length, 2);
  assert.equal(commitCalls[0][1], "config: set a");
  assert.equal(commitCalls[1][1], "config: set b");
});

test("read-only provider rejects writes", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const git = createMockGit();
  const queue = createGitWriteQueue();

  const provider = new GitStorageProvider({
    id: "test-git",
    layer: "defaults",
    repoPath: tmp,
    filePath: "config.json",
    writeQueue: queue,
    git,
    writable: false,
  });

  const result = await provider.write("x", 1);
  assert.equal(result.success, false);
  assert.equal(git.calls.length, 0);
});
