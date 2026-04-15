import test from "node:test";
import assert from "node:assert/strict";
import {
  configAuditEntrySchema,
  emergencyOverrideRecordSchema,
  promotionRequestSchema,
} from "../src/schemas-promotion.ts";

test("configAuditEntrySchema validates a valid entry", () => {
  const entry = {
    timestamp: "2026-04-13T12:00:00Z",
    actor: "user-1",
    action: "set",
    key: "ghost.app.theme",
    layer: "tenant",
    tenantId: "t-1",
    oldValue: "light",
    newValue: "dark",
    changePolicy: "direct-allowed",
    isEmergencyOverride: false,
  };
  const result = configAuditEntrySchema.safeParse(entry);
  assert.equal(result.success, true);
});

test("configAuditEntrySchema validates plugin-management action types", () => {
  const pluginActions = [
    "install",
    "uninstall",
    "enable",
    "disable",
    "promote",
  ];

  for (const action of pluginActions) {
    const entry = {
      timestamp: "2026-04-13T12:00:00Z",
      actor: "user-1",
      action,
      key: "ghost.pluginManager.registry",
      layer: "module",
      isEmergencyOverride: false,
    };

    const result = configAuditEntrySchema.safeParse(entry);
    assert.equal(result.success, true);
  }
});

test("configAuditEntrySchema rejects entry missing required field", () => {
  const entry = {
    timestamp: "2026-04-13T12:00:00Z",
    actor: "user-1",
    action: "set",
    key: "ghost.app.theme",
    layer: "tenant",
    // missing isEmergencyOverride
  };
  const result = configAuditEntrySchema.safeParse(entry);
  assert.equal(result.success, false);
});

test("configAuditEntrySchema rejects unknown action values", () => {
  const entry = {
    timestamp: "2026-04-13T12:00:00Z",
    actor: "user-1",
    action: "unknown-action",
    key: "ghost.pluginManager.registry",
    layer: "module",
    isEmergencyOverride: false,
  };

  const result = configAuditEntrySchema.safeParse(entry);
  assert.equal(result.success, false);
});

test("emergencyOverrideRecordSchema validates a valid record", () => {
  const record = {
    id: "override-1",
    key: "ghost.app.maxConnections",
    actor: "ops-admin",
    reason: "Production incident #1234",
    tenantId: "t-1",
    layer: "tenant",
    createdAt: "2026-04-13T12:00:00Z",
    followUpDeadline: "2026-04-14T12:00:00Z",
  };
  const result = emergencyOverrideRecordSchema.safeParse(record);
  assert.equal(result.success, true);
});

test("emergencyOverrideRecordSchema validates record with regularized fields", () => {
  const record = {
    id: "override-2",
    key: "ghost.app.maxConnections",
    actor: "ops-admin",
    reason: "Production incident #5678",
    tenantId: "t-1",
    layer: "tenant",
    createdAt: "2026-04-13T12:00:00Z",
    followUpDeadline: "2026-04-14T12:00:00Z",
    regularizedAt: "2026-04-13T15:00:00Z",
    regularizedBy: "senior-ops",
  };
  const result = emergencyOverrideRecordSchema.safeParse(record);
  assert.equal(result.success, true);
});

test("promotionRequestSchema validates a valid request", () => {
  const request = {
    id: "promo-1",
    key: "ghost.app.featureFlag",
    fromValue: false,
    toValue: true,
    layer: "app",
    tenantId: "t-1",
    requestedBy: "dev-1",
    requestedAt: "2026-04-13T10:00:00Z",
    status: "pending",
    changePolicy: "staging-gate",
  };
  const result = promotionRequestSchema.safeParse(request);
  assert.equal(result.success, true);
});

test("promotionRequestSchema rejects invalid status", () => {
  const request = {
    id: "promo-1",
    key: "ghost.app.featureFlag",
    fromValue: false,
    toValue: true,
    layer: "app",
    tenantId: "t-1",
    requestedBy: "dev-1",
    requestedAt: "2026-04-13T10:00:00Z",
    status: "invalid-status",
    changePolicy: "staging-gate",
  };
  const result = promotionRequestSchema.safeParse(request);
  assert.equal(result.success, false);
});
