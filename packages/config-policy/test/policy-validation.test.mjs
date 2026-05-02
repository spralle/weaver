import test from "node:test";
import assert from "node:assert/strict";
import { validateChangePolicies } from "../dist/index.js";

/** Helper to create a ComposedSchemaEntry */
function entry(key, schema) {
  return [key, { ownerId: "test-plugin", fullyQualifiedKey: key, schema }];
}

test("security-sensitive key with direct-allowed produces error", () => {
  const schemas = new Map([
    entry("app.auth.apiKey", { type: "string", "x-weaver": { changePolicy: "direct-allowed" } }),
  ]);
  const violations = validateChangePolicies(schemas);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].severity, "error");
  assert.equal(violations[0].key, "app.auth.apiKey");
  assert.equal(violations[0].suggestedPolicy, "full-pipeline");
});

test("security-sensitive key with full-pipeline produces no violation", () => {
  const schemas = new Map([
    entry("app.auth.password", { type: "string", "x-weaver": { changePolicy: "full-pipeline" } }),
  ]);
  const violations = validateChangePolicies(schemas);
  assert.equal(violations.length, 0);
});

test("internal visibility with direct-allowed produces warning", () => {
  const schemas = new Map([
    entry("app.core.debugLevel", {
      type: "string",
      "x-weaver": {
        changePolicy: "direct-allowed",
        visibility: "internal",
      },
    }),
  ]);
  const violations = validateChangePolicies(schemas);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].severity, "warning");
  assert.equal(violations[0].key, "app.core.debugLevel");
  assert.equal(violations[0].suggestedPolicy, "staging-gate");
});

test("restart-required with direct-allowed produces warning", () => {
  const schemas = new Map([
    entry("app.server.port", {
      type: "number",
      "x-weaver": {
        changePolicy: "direct-allowed",
        reloadBehavior: "restart-required",
      },
    }),
  ]);
  const violations = validateChangePolicies(schemas);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].severity, "warning");
  assert.equal(violations[0].key, "app.server.port");
  assert.equal(violations[0].suggestedPolicy, "staging-gate");
});

test("normal key with direct-allowed produces no violation", () => {
  const schemas = new Map([
    entry("app.ui.theme", { type: "string", "x-weaver": { changePolicy: "direct-allowed" } }),
  ]);
  const violations = validateChangePolicies(schemas);
  assert.equal(violations.length, 0);
});

test("empty schema map produces no violations", () => {
  const schemas = new Map();
  const violations = validateChangePolicies(schemas);
  assert.equal(violations.length, 0);
});

test("security-sensitive key with staging-gate produces no violation", () => {
  const schemas = new Map([
    entry("app.db.credential", { type: "string", "x-weaver": { changePolicy: "staging-gate" } }),
  ]);
  const violations = validateChangePolicies(schemas);
  assert.equal(violations.length, 0);
});

test("multiple violations from one schema map", () => {
  const schemas = new Map([
    entry("app.auth.secret", { type: "string", "x-weaver": { changePolicy: "direct-allowed" } }),
    entry("app.core.internal", {
      type: "string",
      "x-weaver": {
        changePolicy: "direct-allowed",
        visibility: "internal",
      },
    }),
    entry("app.server.port", {
      type: "number",
      "x-weaver": {
        changePolicy: "direct-allowed",
        reloadBehavior: "restart-required",
      },
    }),
    entry("app.ui.color", { type: "string", "x-weaver": { changePolicy: "direct-allowed" } }),
  ]);
  const violations = validateChangePolicies(schemas);
  const errors = violations.filter((v) => v.severity === "error");
  const warnings = violations.filter((v) => v.severity === "warning");
  assert.equal(errors.length, 1); // secret
  assert.equal(warnings.length, 2); // internal + restart-required
});

test("sensitive + public visibility produces error", () => {
  const schemas = new Map([
    entry("app.db.connectionString", {
      type: "string",
      "x-weaver": { sensitive: true, visibility: "public" },
    }),
  ]);
  const violations = validateChangePolicies(schemas);
  const match = violations.find((v) => v.violation.includes("Sensitive key"));
  assert.ok(match);
  assert.equal(match.severity, "error");
});

test("sensitive + admin visibility produces no sensitive-public violation", () => {
  const schemas = new Map([
    entry("app.db.connectionString", {
      type: "string",
      "x-weaver": { sensitive: true, visibility: "admin" },
    }),
  ]);
  const violations = validateChangePolicies(schemas);
  const match = violations.find((v) => v.violation.includes("Sensitive key"));
  assert.equal(match, undefined);
});

test("sensitive + internal visibility produces no sensitive-public violation", () => {
  const schemas = new Map([
    entry("app.db.connectionString", {
      type: "string",
      "x-weaver": { sensitive: true, visibility: "internal" },
    }),
  ]);
  const violations = validateChangePolicies(schemas);
  const match = violations.find((v) => v.violation.includes("Sensitive key"));
  assert.equal(match, undefined);
});

test("sensitive + platform visibility produces no sensitive-public violation", () => {
  const schemas = new Map([
    entry("app.db.connectionString", {
      type: "string",
      "x-weaver": { sensitive: true, visibility: "platform" },
    }),
  ]);
  const violations = validateChangePolicies(schemas);
  const match = violations.find((v) => v.violation.includes("Sensitive key"));
  assert.equal(match, undefined);
});

test("not sensitive + public visibility produces no sensitive-public violation", () => {
  const schemas = new Map([
    entry("app.ui.theme", {
      type: "string",
      "x-weaver": { sensitive: false, visibility: "public" },
    }),
  ]);
  const violations = validateChangePolicies(schemas);
  const match = violations.find((v) => v.violation.includes("Sensitive key"));
  assert.equal(match, undefined);
});

test("key with no explicit changePolicy defaults to direct-allowed for check", () => {
  const schemas = new Map([
    entry("app.auth.token", { type: "string" }), // no changePolicy → defaults to direct-allowed
  ]);
  const violations = validateChangePolicies(schemas);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].severity, "error");
  assert.equal(violations[0].currentPolicy, "direct-allowed");
});
