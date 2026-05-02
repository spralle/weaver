import test from "node:test";
import assert from "node:assert/strict";
import { configSnapshotSchema } from "../../src/types/snapshot.ts";

test("configSnapshotSchema validates valid snapshot", () => {
  const result = configSnapshotSchema.safeParse({
    platform: { "app.theme": "light" },
    tenants: {},
    revision: "abc123",
    timestamp: "2026-05-01T00:00:00Z",
  });
  assert.equal(result.success, true);
});

test("configSnapshotSchema validates snapshot with multiple tenants", () => {
  const result = configSnapshotSchema.safeParse({
    platform: {},
    tenants: {
      "tenant-a": { "app.theme": "dark" },
      "tenant-b": { "app.logo": "logo.png" },
    },
    revision: "def456",
    timestamp: "2026-05-01T00:00:00Z",
  });
  assert.equal(result.success, true);
});
