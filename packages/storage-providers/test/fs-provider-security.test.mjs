import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createFileSystemStorageProvider } from "../src/fs-provider.ts";

async function makeTempProvider() {
  const dir = join(tmpdir(), `weaver-sec-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, "config.json");
  await writeFile(filePath, JSON.stringify({}), "utf-8");
  return createFileSystemStorageProvider({
    id: "test",
    layer: "platform",
    filePath,
    writable: true,
  });
}

test("rejects key with path traversal (..)", async () => {
  const provider = await makeTempProvider();
  await assert.rejects(
    () => provider.write("../etc/passwd", "evil"),
    /Path traversal rejected/,
  );
});

test("rejects key with nested traversal", async () => {
  const provider = await makeTempProvider();
  await assert.rejects(
    () => provider.write("foo/../../bar", "evil"),
    /Path traversal rejected/,
  );
});

test("rejects key with null byte", async () => {
  const provider = await makeTempProvider();
  await assert.rejects(
    () => provider.write("foo\x00bar", "evil"),
    /control characters/,
  );
});

test("rejects key with control characters", async () => {
  const provider = await makeTempProvider();
  await assert.rejects(
    () => provider.write("foo\x01bar", "evil"),
    /control characters/,
  );
});

test("allows normal dotted keys", async () => {
  const provider = await makeTempProvider();
  const result = await provider.write("app.database.host", "localhost");
  assert.equal(result.success, true);
});

test("remove rejects traversal keys", async () => {
  const provider = await makeTempProvider();
  await assert.rejects(
    () => provider.remove("../etc/shadow"),
    /Path traversal rejected/,
  );
});
