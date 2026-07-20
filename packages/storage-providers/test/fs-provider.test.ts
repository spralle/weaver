import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileSystemStorageProvider } from "../src/fs-provider.js";

let testDir: string;
let filePath: string;

beforeAll(async () => {
  testDir = join(tmpdir(), `weaver-fs-${randomUUID()}`);
  await mkdir(testDir, { recursive: true });
  filePath = join(testDir, "config.json");
  await writeFile(
    filePath,
    JSON.stringify({ "app.name": "test", "app.port": 3000 }),
    "utf-8",
  );
});

afterAll(async () => {
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
    expect(data.entries["app.name"]).toBe("test");
    expect(data.entries["app.port"]).toBe(3000);
  });

  it("writes a key and persists it", async () => {
    const provider = createFileSystemStorageProvider({
      id: "fs-test",
      layer: "app",
      filePath,
      writable: true,
    });
    expect(typeof provider.write).toBe("function");
    const result = await provider.write("app.new", "hello");
    expect(result.success).toBe(true);
    const data = await provider.load();
    expect((data.entries.app as Record<string, unknown>)?.new).toBe("hello");
  });

  it("removes a key", async () => {
    const provider = createFileSystemStorageProvider({
      id: "fs-test",
      layer: "app",
      filePath,
      writable: true,
    });
    expect(typeof provider.write).toBe("function");
    expect(typeof provider.remove).toBe("function");
    await provider.write("temp.val", "x");
    const result = await provider.remove("temp.val");
    expect(result.success).toBe(true);
    const data = await provider.load();
    expect((data.entries.temp as Record<string, unknown>)?.val).toBe(undefined);
  });

  it("reports writable status from options", () => {
    const provider = createFileSystemStorageProvider({
      id: "fs-ro",
      layer: "app",
      filePath,
      writable: false,
    });
    expect(provider.writable).toBe(false);
  });
});
