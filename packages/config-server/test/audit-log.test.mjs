import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { createFileSystemAuditLog } from "../src/fs-audit-log.ts";
import { createInMemoryAuditLog } from "../src/memory-audit-log.ts";

function makeTempPath() {
  return join(tmpdir(), `audit-log-test-${randomUUID()}`, "audit.jsonl");
}

function makeEntry(overrides = {}) {
  return {
    timestamp: "2026-04-13T12:00:00Z",
    actor: "user-1",
    action: "set",
    key: "ghost.app.theme",
    layer: "tenant",
    isEmergencyOverride: false,
    ...overrides,
  };
}

test("append writes entry and queryByKey retrieves it", async () => {
  const filePath = makeTempPath();
  const log = createFileSystemAuditLog(filePath);

  try {
    const entry = makeEntry();
    await log.append(entry);
    const results = await log.queryByKey("ghost.app.theme");
    assert.equal(results.length, 1);
    assert.equal(results[0].key, "ghost.app.theme");
    assert.equal(results[0].actor, "user-1");
  } finally {
    await rm(join(filePath, ".."), { recursive: true, force: true });
  }
});

test("queryByKey returns entries most-recent-first", async () => {
  const filePath = makeTempPath();
  const log = createFileSystemAuditLog(filePath);

  try {
    await log.append(makeEntry({ timestamp: "2026-04-13T10:00:00Z" }));
    await log.append(makeEntry({ timestamp: "2026-04-13T14:00:00Z" }));
    await log.append(makeEntry({ timestamp: "2026-04-13T12:00:00Z" }));

    const results = await log.queryByKey("ghost.app.theme");
    assert.equal(results.length, 3);
    assert.equal(results[0].timestamp, "2026-04-13T14:00:00Z");
    assert.equal(results[1].timestamp, "2026-04-13T12:00:00Z");
    assert.equal(results[2].timestamp, "2026-04-13T10:00:00Z");
  } finally {
    await rm(join(filePath, ".."), { recursive: true, force: true });
  }
});

test("queryByTimeRange filters correctly", async () => {
  const filePath = makeTempPath();
  const log = createFileSystemAuditLog(filePath);

  try {
    await log.append(makeEntry({ timestamp: "2026-04-13T08:00:00Z" }));
    await log.append(makeEntry({ timestamp: "2026-04-13T12:00:00Z" }));
    await log.append(makeEntry({ timestamp: "2026-04-13T16:00:00Z" }));

    const results = await log.queryByTimeRange(
      "2026-04-13T10:00:00Z",
      "2026-04-13T14:00:00Z",
    );
    assert.equal(results.length, 1);
    assert.equal(results[0].timestamp, "2026-04-13T12:00:00Z");
  } finally {
    await rm(join(filePath, ".."), { recursive: true, force: true });
  }
});

test("getRecent with limit returns correct count", async () => {
  const filePath = makeTempPath();
  const log = createFileSystemAuditLog(filePath);

  try {
    await log.append(makeEntry({ timestamp: "2026-04-13T10:00:00Z" }));
    await log.append(makeEntry({ timestamp: "2026-04-13T12:00:00Z" }));
    await log.append(makeEntry({ timestamp: "2026-04-13T14:00:00Z" }));

    const results = await log.getRecent(2);
    assert.equal(results.length, 2);
    assert.equal(results[0].timestamp, "2026-04-13T14:00:00Z");
    assert.equal(results[1].timestamp, "2026-04-13T12:00:00Z");
  } finally {
    await rm(join(filePath, ".."), { recursive: true, force: true });
  }
});

test("empty/missing file returns empty array", async () => {
  const filePath = makeTempPath();
  const log = createFileSystemAuditLog(filePath);

  const byKey = await log.queryByKey("nonexistent");
  assert.deepEqual(byKey, []);

  const recent = await log.getRecent();
  assert.deepEqual(recent, []);

  const range = await log.queryByTimeRange(
    "2026-01-01T00:00:00Z",
    "2026-12-31T23:59:59Z",
  );
  assert.deepEqual(range, []);
});

test("InMemoryAuditLog works identically", async () => {
  const log = createInMemoryAuditLog();

  await log.append(makeEntry({ timestamp: "2026-04-13T10:00:00Z" }));
  await log.append(makeEntry({ timestamp: "2026-04-13T14:00:00Z" }));
  await log.append(
    makeEntry({ timestamp: "2026-04-13T12:00:00Z", key: "other.key" }),
  );

  // queryByKey
  const byKey = await log.queryByKey("ghost.app.theme");
  assert.equal(byKey.length, 2);
  assert.equal(byKey[0].timestamp, "2026-04-13T14:00:00Z");

  // getRecent with limit
  const recent = await log.getRecent(2);
  assert.equal(recent.length, 2);
  assert.equal(recent[0].timestamp, "2026-04-13T14:00:00Z");

  // queryByTimeRange
  const range = await log.queryByTimeRange(
    "2026-04-13T11:00:00Z",
    "2026-04-13T13:00:00Z",
  );
  assert.equal(range.length, 1);
  assert.equal(range[0].key, "other.key");
});
