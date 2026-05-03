import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { FileSystemStorageProvider } from "../src/fs-provider.ts";

function makeTempDir() {
  return join(tmpdir(), `fs-watch-test-${randomUUID()}`);
}

test("onExternalChange fires when file is modified externally", async () => {
  const dir = makeTempDir();
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, "config.json");
  await writeFile(filePath, JSON.stringify({ a: 1, b: 2 }));

  try {
    const provider = new FileSystemStorageProvider({
      id: "test",
      layer: "app",
      filePath,
      watchDebounceMs: 50,
    });

    const received = [];
    const unsubscribe = provider.onExternalChange((changes) => {
      received.push(changes);
    });

    // Wait for watcher to initialize
    await sleep(100);

    // External write
    await writeFile(filePath, JSON.stringify({ a: 1, b: 99, c: 3 }));

    // Wait for debounce + processing
    await sleep(300);

    assert.equal(received.length, 1);
    const changes = received[0];
    assert.ok(changes.some((c) => c.key === "b" && c.newValue === 99));
    assert.ok(changes.some((c) => c.key === "c" && c.newValue === 3));

    unsubscribe();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("onExternalChange debounces rapid writes", async () => {
  const dir = makeTempDir();
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, "config.json");
  await writeFile(filePath, JSON.stringify({ x: 1 }));

  try {
    const provider = new FileSystemStorageProvider({
      id: "test",
      layer: "app",
      filePath,
      watchDebounceMs: 80,
    });

    const received = [];
    const unsubscribe = provider.onExternalChange((changes) => {
      received.push(changes);
    });

    await sleep(100);

    // Rapid writes — should coalesce into one callback
    await writeFile(filePath, JSON.stringify({ x: 2 }));
    await sleep(20);
    await writeFile(filePath, JSON.stringify({ x: 3 }));
    await sleep(20);
    await writeFile(filePath, JSON.stringify({ x: 4 }));

    await sleep(300);

    // Should have at most 1-2 callbacks (debounced), final value is 4
    assert.ok(received.length <= 2, `Expected <=2 callbacks, got ${received.length}`);
    const lastChanges = received[received.length - 1];
    assert.ok(lastChanges.some((c) => c.key === "x" && c.newValue === 4));

    unsubscribe();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("dispose() stops watching", async () => {
  const dir = makeTempDir();
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, "config.json");
  await writeFile(filePath, JSON.stringify({ v: 1 }));

  try {
    const provider = new FileSystemStorageProvider({
      id: "test",
      layer: "app",
      filePath,
      watchDebounceMs: 50,
    });

    const received = [];
    provider.onExternalChange((changes) => {
      received.push(changes);
    });

    await sleep(100);
    provider.dispose();

    // Write after dispose — should not trigger callback
    await writeFile(filePath, JSON.stringify({ v: 999 }));
    await sleep(200);

    assert.equal(received.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("onExternalChange does not fire when no keys actually changed", async () => {
  const dir = makeTempDir();
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, "config.json");
  await writeFile(filePath, JSON.stringify({ a: 1 }));

  try {
    const provider = new FileSystemStorageProvider({
      id: "test",
      layer: "app",
      filePath,
      watchDebounceMs: 50,
    });

    const received = [];
    const unsubscribe = provider.onExternalChange((changes) => {
      received.push(changes);
    });

    await sleep(100);

    // Rewrite same content
    await writeFile(filePath, JSON.stringify({ a: 1 }));
    await sleep(200);

    assert.equal(received.length, 0);
    unsubscribe();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
