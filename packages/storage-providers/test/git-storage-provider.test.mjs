import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGitStorageProvider } from "../src/git-storage-provider.ts";

function createMockGitManager(localPath) {
  const calls = [];
  return {
    calls,
    localPath,
    async ensureClone() { calls.push(["ensureClone"]); },
    async pull() { calls.push(["pull"]); return { success: true }; },
    async refresh() { calls.push(["refresh"]); return { success: true }; },
    async commitAndPush(message, files) { calls.push(["commitAndPush", message, files]); return { success: true }; },
  };
}

test("load() delegates to FileSystemStorageProvider", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({ foo: "bar" }));

  const gitManager = createMockGitManager(tmp);

  const provider = createGitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  const data = await provider.load();
  expect(data.entries).toEqual({ foo: "bar" });
});

test("write() is local-only — no git calls happen", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const gitManager = createMockGitManager(tmp);

  const provider = createGitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  const result = await provider.write("key1", "value1");
  expect(result.success).toBe(true);
  expect(gitManager.calls.length).toBe(0);
});

test("write() marks provider as dirty", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const gitManager = createMockGitManager(tmp);

  const provider = createGitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  expect(provider.dirty).toBe(false);
  await provider.write("key1", "value1");
  expect(provider.dirty).toBe(true);
});

test("flush() calls gitManager.commitAndPush() with dirty files", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const gitManager = createMockGitManager(tmp);

  const provider = createGitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  await provider.write("key1", "value1");
  await provider.flush();

  expect(gitManager.calls.length).toBe(1);
  expect(gitManager.calls[0][0]).toBe("commitAndPush");
  expect(gitManager.calls[0][1]).toBe("config: set key1");
  expect(gitManager.calls[0][2]).toEqual(["config.json"]);
  expect(provider.dirty).toBe(false);
});

test("flush() on clean provider is no-op", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const gitManager = createMockGitManager(tmp);

  const provider = createGitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  await provider.flush();
  expect(gitManager.calls.length).toBe(0);
});

test("flush() builds batch commit message for multiple changes", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const gitManager = createMockGitManager(tmp);

  const provider = createGitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  await provider.write("a", 1);
  await provider.write("b", 2);
  await provider.flush();

  expect(gitManager.calls[0][1]).toBe("config: 2 changes in defaults");
});

test("remove() is local-only, marks dirty", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({ key1: "val" }));

  const gitManager = createMockGitManager(tmp);

  const provider = createGitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  const result = await provider.remove("key1");
  expect(result.success).toBe(true);
  expect(provider.dirty).toBe(true);
  expect(gitManager.calls.length).toBe(0);
});

test("refresh() calls gitManager.refresh()", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const gitManager = createMockGitManager(tmp);

  const provider = createGitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
  });

  await provider.refresh();
  expect(gitManager.calls.length).toBe(1);
  expect(gitManager.calls[0]).toEqual(["refresh"]);
});

test("read-only provider rejects writes", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "git-sp-"));
  await writeFile(join(tmp, "config.json"), JSON.stringify({}));

  const gitManager = createMockGitManager(tmp);

  const provider = createGitStorageProvider({
    id: "test-git",
    layer: "defaults",
    gitManager,
    filePath: "config.json",
    writable: false,
  });

  const result = await provider.write("x", 1);
  expect(result.success).toBe(false);
  expect(gitManager.calls.length).toBe(0);
});
