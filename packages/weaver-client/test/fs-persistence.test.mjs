import { createFileSystemPersistence } from "../src/fs-persistence.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function createTempDir() {
  return mkdtempSync(join(tmpdir(), "weaver-test-"));
}

const testSnapshot = {
  entries: { "db.host": "localhost" },
  scopes: { "tenant:t1": { "key": "val" } },
  revision: "rev-1",
  timestamp: "2026-01-01T00:00:00Z",
};

describe("FileSystemPersistence", () => {
  test("save writes JSON file", async () => {
    const dir = createTempDir();
    try {
      const p = createFileSystemPersistence({ directory: dir });
      await p.save("my-namespace", testSnapshot);
      const { existsSync } = await import("node:fs");
      expect(existsSync(join(dir, "my-namespace.json"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  test("load reads JSON file", async () => {
    const dir = createTempDir();
    try {
      const p = createFileSystemPersistence({ directory: dir });
      await p.save("ns", testSnapshot);
      const loaded = await p.load("ns");
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
      expect(loaded).toBe(null);
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
