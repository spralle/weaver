import { test, expect, describe } from "bun:test";
import { createFileSystemPersistence } from "../src/fs-persistence.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function createTempDir() {
  return mkdtempSync(join(tmpdir(), "weaver-test-"));
}

const testSnapshot = {
  platform: { "db.host": "localhost" },
  tenants: { "t1": { "key": "val" } },
  revision: "rev-1",
  timestamp: "2026-01-01T00:00:00Z",
};

describe("FileSystemPersistence", () => {
  test("save writes JSON file", async () => {
    const dir = createTempDir();
    try {
      const p = createFileSystemPersistence({ directory: dir });
      await p.save("my-service", testSnapshot);
      const { existsSync } = await import("node:fs");
      expect(existsSync(join(dir, "my-service.json"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  test("load reads JSON file", async () => {
    const dir = createTempDir();
    try {
      const p = createFileSystemPersistence({ directory: dir });
      await p.save("svc", testSnapshot);
      const loaded = await p.load("svc");
      expect(loaded).toEqual(testSnapshot);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  test("load returns null for missing file", async () => {
    const dir = createTempDir();
    try {
      const p = createFileSystemPersistence({ directory: dir });
      const loaded = await p.load("nonexistent");
      expect(loaded).toBeNull();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  test("save/load roundtrip preserves snapshot", async () => {
    const dir = createTempDir();
    try {
      const p = createFileSystemPersistence({ directory: dir });
      await p.save("roundtrip", testSnapshot);
      const loaded = await p.load("roundtrip");
      expect(loaded).toEqual(testSnapshot);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
