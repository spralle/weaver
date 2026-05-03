import { test } from "bun:test";
import assert from "node:assert/strict";
import { configSnapshotSchema } from "@weaver/config-types";

test("configSnapshotSchema validates valid snapshot", () => {
  const result = configSnapshotSchema.safeParse({
    entries: { "app.theme": "light" },
    scopes: {},
    revision: "abc123",
    timestamp: "2026-05-01T00:00:00Z",
  });
  assert.equal(result.success, true);
});

test("configSnapshotSchema validates snapshot with scopes", () => {
  const result = configSnapshotSchema.safeParse({
    entries: {},
    scopes: {
      "tenant:acme": { "app.theme": "dark" },
      "tenant:globex": { "app.logo": "logo.png" },
    },
    revision: "def456",
    timestamp: "2026-05-01T00:00:00Z",
  });
  assert.equal(result.success, true);
});

test("configSnapshotSchema allows optional timestamp", () => {
  const result = configSnapshotSchema.safeParse({
    entries: {},
    scopes: {},
    revision: "rev1",
  });
  assert.equal(result.success, true);
});
