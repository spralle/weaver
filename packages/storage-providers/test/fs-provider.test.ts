import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { createFileSystemStorageProvider } from "../src/fs-provider.js";

let testDir: string;
let filePath: string;

before(async () => {
  testDir = join(tmpdir(), `weaver-fs-${randomUUID()}`);
  await mkdir(testDir, { recursive: true });
  filePath = join(testDir, "config.json");
  await writeFile(
    filePath,
    JSON.stringify({ "app.name": "test", "app.port": 3000 }),
    "utf-8",
  );
});

after(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("FileSystemStorageProvider", () => {
  it("loads entries from a JSON file", async () => {
    const provider = createFileSystemStorageProvider({
      id: "fs-test",
      layer: "app",
      filePath,
      writable: true,
    });
    const data = await provider.load();
    assert.equal(data.entries["app.name"], "test");
    assert.equal(data.entries["app.port"], 3000);
  });

  it("writes a key and persists it", async () => {
    const provider = createFileSystemStorageProvider({
      id: "fs-test",
      layer: "app",
      filePath,
      writable: true,
    });
    assert.equal(typeof provider.write, "function");
    const result = await provider.write("app.new", "hello");
    assert.equal(result.success, true);
    const data = await provider.load();
    assert.equal((data.entries.app as Record<string, unknown>)?.new, "hello");
  });

  it("removes a key", async () => {
    const provider = createFileSystemStorageProvider({
      id: "fs-test",
      layer: "app",
      filePath,
      writable: true,
    });
    assert.equal(typeof provider.write, "function");
    assert.equal(typeof provider.remove, "function");
    await provider.write("temp.val", "x");
    const result = await provider.remove("temp.val");
    assert.equal(result.success, true);
    const data = await provider.load();
    assert.equal(
      (data.entries.temp as Record<string, unknown>)?.val,
      undefined,
    );
  });

  it("reports writable status from options", () => {
    const provider = createFileSystemStorageProvider({
      id: "fs-ro",
      layer: "app",
      filePath,
      writable: false,
    });
    assert.equal(provider.writable, false);
  });
});
