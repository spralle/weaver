import test from "node:test";
import assert from "node:assert/strict";
import { createServiceConfigurationService } from "../src/service-configuration.ts";

function createMockConfigService(data = {}) {
  const listeners = new Map();
  return {
    get(key) { return data[key]; },
    getWithDefault(key, defaultValue) { return data[key] ?? defaultValue; },
    getAtLayer() { return undefined; },
    getForScope() { return undefined; },
    inspect() { return { key: "", effectiveValue: undefined, effectiveLayer: undefined }; },
    set(key, value) { data[key] = value; },
    remove(key) { delete data[key]; },
    onChange(key, listener) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(listener);
      return () => { listeners.get(key)?.delete(listener); };
    },
    getNamespace() { return {}; },
    _triggerChange(key, value) {
      for (const l of listeners.get(key) ?? []) l(value);
    },
  };
}

test("get() resolves key within declared namespace", () => {
  const mock = createMockConfigService({ "ghost.backend.port": 3000 });
  const svc = createServiceConfigurationService({
    configService: mock,
    namespace: "ghost.backend",
  });
  assert.equal(svc.get("port"), 3000);
});

test("getWithDefault() returns default when key absent", () => {
  const mock = createMockConfigService({});
  const svc = createServiceConfigurationService({
    configService: mock,
    namespace: "ghost.backend",
  });
  assert.equal(svc.getWithDefault("port", 8080), 8080);
});

test("getWithDefault() returns stored value when key present", () => {
  const mock = createMockConfigService({ "ghost.backend.port": 3000 });
  const svc = createServiceConfigurationService({
    configService: mock,
    namespace: "ghost.backend",
  });
  assert.equal(svc.getWithDefault("port", 8080), 3000);
});

test("getFromNamespace() reads from a different namespace", () => {
  const mock = createMockConfigService({ "ghost.shared.logLevel": "debug" });
  const svc = createServiceConfigurationService({
    configService: mock,
    namespace: "ghost.backend",
  });
  assert.equal(svc.getFromNamespace("ghost.shared", "logLevel"), "debug");
});

test("onChange() fires for namespaced key changes", () => {
  const mock = createMockConfigService({});
  const svc = createServiceConfigurationService({
    configService: mock,
    namespace: "ghost.backend",
  });
  const values = [];
  svc.onChange("port", (v) => values.push(v));
  mock._triggerChange("ghost.backend.port", 4000);
  assert.deepEqual(values, [4000]);
});

test("onChange() returns unsubscribe function", () => {
  const mock = createMockConfigService({});
  const svc = createServiceConfigurationService({
    configService: mock,
    namespace: "ghost.backend",
  });
  const values = [];
  const unsub = svc.onChange("port", (v) => values.push(v));
  mock._triggerChange("ghost.backend.port", 4000);
  unsub();
  mock._triggerChange("ghost.backend.port", 5000);
  assert.deepEqual(values, [4000]);
});

test("pendingRestart becomes true when restart-required key changes", () => {
  const mock = createMockConfigService({});
  const schemaMap = new Map([
    ["port", { type: "number", reloadBehavior: "restart-required" }],
  ]);
  const svc = createServiceConfigurationService({
    configService: mock,
    namespace: "ghost.backend",
    schemaMap,
  });
  assert.equal(svc.pendingRestart, false);
  mock._triggerChange("ghost.backend.port", 9090);
  assert.equal(svc.pendingRestart, true);
});

test("onRestartRequired() listener fires on restart-requiring change", () => {
  const mock = createMockConfigService({});
  const schemaMap = new Map([
    ["port", { type: "number", reloadBehavior: "restart-required" }],
  ]);
  const svc = createServiceConfigurationService({
    configService: mock,
    namespace: "ghost.backend",
    schemaMap,
  });
  let fired = false;
  svc.onRestartRequired(() => { fired = true; });
  mock._triggerChange("ghost.backend.port", 9090);
  assert.equal(fired, true);
});

test("onRestartRequired() unsubscribe works", () => {
  const mock = createMockConfigService({});
  const schemaMap = new Map([
    ["port", { type: "number", reloadBehavior: "restart-required" }],
  ]);
  const svc = createServiceConfigurationService({
    configService: mock,
    namespace: "ghost.backend",
    schemaMap,
  });
  let callCount = 0;
  const unsub = svc.onRestartRequired(() => { callCount++; });
  mock._triggerChange("ghost.backend.port", 9090);
  assert.equal(callCount, 1);
  unsub();
  mock._triggerChange("ghost.backend.port", 9091);
  assert.equal(callCount, 1);
});

test("pendingRestart stays false when hot-reload key changes", () => {
  const mock = createMockConfigService({});
  const schemaMap = new Map([
    ["theme", { type: "string", reloadBehavior: "hot" }],
  ]);
  const svc = createServiceConfigurationService({
    configService: mock,
    namespace: "ghost.backend",
    schemaMap,
  });
  mock._triggerChange("ghost.backend.theme", "dark");
  assert.equal(svc.pendingRestart, false);
});

test("rolling-restart keys also trigger pendingRestart", () => {
  const mock = createMockConfigService({});
  const schemaMap = new Map([
    ["workers", { type: "number", reloadBehavior: "rolling-restart" }],
  ]);
  const svc = createServiceConfigurationService({
    configService: mock,
    namespace: "ghost.backend",
    schemaMap,
  });
  assert.equal(svc.pendingRestart, false);
  mock._triggerChange("ghost.backend.workers", 4);
  assert.equal(svc.pendingRestart, true);
});
