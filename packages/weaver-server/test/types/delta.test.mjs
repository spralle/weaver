import { test } from "bun:test";
import assert from "node:assert/strict";
import { configDeltaSchema } from "../../src/types/delta.ts";

test("configDeltaSchema validates set delta", () => {
  const result = configDeltaSchema.safeParse({
    action: "set",
    key: "app.theme",
    value: "dark",
    layer: "tenant",
    environment: "production",
    timestamp: "2026-05-01T00:00:00Z",
  });
  assert.equal(result.success, true);
});

test("configDeltaSchema validates remove delta with null value", () => {
  const result = configDeltaSchema.safeParse({
    action: "remove",
    key: "app.theme",
    value: null,
    layer: "tenant",
    environment: "production",
    timestamp: "2026-05-01T00:00:00Z",
  });
  assert.equal(result.success, true);
});

test("configDeltaSchema rejects invalid action", () => {
  const result = configDeltaSchema.safeParse({
    action: "update",
    key: "app.theme",
    value: "dark",
    layer: "tenant",
    environment: "production",
    timestamp: "2026-05-01T00:00:00Z",
  });
  assert.equal(result.success, false);
});
