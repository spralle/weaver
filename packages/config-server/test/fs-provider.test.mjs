import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { FileSystemStorageProvider } from "../src/fs-provider.ts";

function makeTempDir() {
  const dir = join(tmpdir(), `config-server-test-${randomUUID()}`);
  return dir;
}

test("load() reads valid JSON file", async () => {
  const dir = makeTempDir();
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, "config.json");
  await writeFile(filePath, JSON.stringify({ theme: "dark", fontSize: 14 }));

  try {
    const provider = new FileSystemStorageProvider({
      id: "test",
      layer: "app",
      filePath,
    });
    const data = await provider.load();
    assert.deepEqual(data.entries, { theme: "dark", fontSize: 14 });
    assert.equal(typeof data.revision, "string");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("load() merges environment overlay", async () => {
  const dir = makeTempDir();
  await mkdir(dir, { recursive: true });
  const basePath = join(dir, "base.json");
  const overlayPath = join(dir, "overlay.json");
  await writeFile(basePath, JSON.stringify({ a: 1, b: { c: 2, d: 3 } }));
  await writeFile(overlayPath, JSON.stringify({ b: { c: 20 }, e: 5 }));

  try {
    const provider = new FileSystemStorageProvider({
      id: "test",
      layer: "app",
      filePath: basePath,
      environmentOverlayPath: overlayPath,
    });
    const data = await provider.load();
    assert.deepEqual(data.entries, { a: 1, b: { c: 20, d: 3 }, e: 5 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("load() returns empty entries for missing file", async () => {
  const dir = makeTempDir();
  const filePath = join(dir, "nonexistent.json");

  const provider = new FileSystemStorageProvider({
    id: "test",
    layer: "core",
    filePath,
  });
  const data = await provider.load();
  assert.deepEqual(data.entries, {});
  assert.equal(data.revision, undefined);
});

test("load() returns empty entries for invalid JSON with console.warn", async () => {
  const dir = makeTempDir();
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, "bad.json");
  await writeFile(filePath, "not valid json {{{");

  try {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));

    const provider = new FileSystemStorageProvider({
      id: "test",
      layer: "core",
      filePath,
    });
    const data = await provider.load();

    console.warn = originalWarn;

    assert.deepEqual(data.entries, {});
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes(filePath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("write() creates file and writes key", async () => {
  const dir = makeTempDir();
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, "config.json");

  try {
    const provider = new FileSystemStorageProvider({
      id: "test",
      layer: "tenant",
      filePath,
      writable: true,
    });
    const result = await provider.write("theme", "light");
    assert.equal(result.success, true);
    assert.equal(typeof result.revision, "string");

    const raw = JSON.parse(await readFile(filePath, "utf-8"));
    assert.deepEqual(raw, { theme: "light" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("write() on read-only provider returns failure", async () => {
  const dir = makeTempDir();
  const filePath = join(dir, "config.json");

  const provider = new FileSystemStorageProvider({
    id: "test",
    layer: "core",
    filePath,
    writable: false,
  });
  const result = await provider.write("key", "value");
  assert.equal(result.success, false);
  assert.equal(result.error, "Provider is read-only");
});

test("remove() removes key from file", async () => {
  const dir = makeTempDir();
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, "config.json");
  await writeFile(filePath, JSON.stringify({ a: 1, b: 2, c: 3 }));

  try {
    const provider = new FileSystemStorageProvider({
      id: "test",
      layer: "tenant",
      filePath,
      writable: true,
    });
    const result = await provider.remove("b");
    assert.equal(result.success, true);

    const raw = JSON.parse(await readFile(filePath, "utf-8"));
    assert.deepEqual(raw, { a: 1, c: 3 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("write() creates parent directory if needed", async () => {
  const dir = makeTempDir();
  const nested = join(dir, "sub", "deep");
  const filePath = join(nested, "config.json");

  try {
    const provider = new FileSystemStorageProvider({
      id: "test",
      layer: "tenant",
      filePath,
      writable: true,
    });
    const result = await provider.write("key", "value");
    assert.equal(result.success, true);

    const raw = JSON.parse(await readFile(filePath, "utf-8"));
    assert.deepEqual(raw, { key: "value" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("remove() on read-only provider returns failure", async () => {
  const dir = makeTempDir();
  const filePath = join(dir, "config.json");

  const provider = new FileSystemStorageProvider({
    id: "test",
    layer: "core",
    filePath,
  });
  const result = await provider.remove("key");
  assert.equal(result.success, false);
  assert.equal(result.error, "Provider is read-only");
});

test("revision is returned as ISO string", async () => {
  const dir = makeTempDir();
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, "config.json");
  await writeFile(filePath, JSON.stringify({ x: 1 }));

  try {
    const provider = new FileSystemStorageProvider({
      id: "test",
      layer: "app",
      filePath,
    });
    const data = await provider.load();
    assert.equal(typeof data.revision, "string");
    // Verify it's a valid ISO date
    const parsed = new Date(data.revision);
    assert.ok(!isNaN(parsed.getTime()));
    assert.ok(data.revision.includes("T"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writable defaults to false", () => {
  const provider = new FileSystemStorageProvider({
    id: "test",
    layer: "core",
    filePath: "/tmp/nonexistent.json",
  });
  assert.equal(provider.writable, false);
});
