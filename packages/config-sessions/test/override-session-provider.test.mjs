import test from "node:test";
import assert from "node:assert/strict";
import { createOverrideSessionProvider } from "../src/override-session-provider.ts";

// Fake timer that allows manual triggering of scheduled callbacks
function createFakeTimer() {
  let callback = null;
  let scheduledMs = null;
  let cleared = false;
  let timeoutId = 1;

  return {
    impl: {
      setTimeout(fn, ms) {
        callback = fn;
        scheduledMs = ms;
        cleared = false;
        return timeoutId++;
      },
      clearTimeout(_id) {
        callback = null;
        scheduledMs = null;
        cleared = true;
      },
    },
    fire() {
      if (callback !== null && !cleared) {
        const fn = callback;
        callback = null;
        fn();
      }
    },
    get scheduledMs() {
      return scheduledMs;
    },
    get wasCleared() {
      return cleared;
    },
  };
}

test("activate creates session with correct metadata", () => {
  const controller = createOverrideSessionProvider({
    timer: createFakeTimer().impl,
  });

  const session = controller.activate({ reason: "debugging" });

  assert.ok(session.id, "session should have an id");
  assert.ok(session.activatedAt, "session should have activatedAt");
  assert.ok(session.expiresAt, "session should have expiresAt");
  assert.equal(session.activatedBy, "system");
  assert.equal(session.reason, "debugging");
  assert.equal(session.isActive, true);
  assert.deepEqual(session.overrides, {});

  controller.dispose();
});

test("activate rejects when session already active", () => {
  const controller = createOverrideSessionProvider({
    timer: createFakeTimer().impl,
  });

  controller.activate({ reason: "first" });

  assert.throws(
    () => controller.activate({ reason: "second" }),
    { message: "Session already active" },
  );

  controller.dispose();
});

test("deactivate clears overrides and returns count", async () => {
  const controller = createOverrideSessionProvider({
    timer: createFakeTimer().impl,
    onAudit: () => {},
  });

  controller.activate({ reason: "test" });
  await controller.provider.write("key1", "val1");
  await controller.provider.write("key2", "val2");

  const result = controller.deactivate();

  assert.equal(result.overridesCleared, 2);
  assert.ok(result.sessionId, "should have sessionId");
  assert.ok(result.deactivatedAt, "should have deactivatedAt");
  assert.equal(result.auditRecorded, true);

  // Storage should be empty after deactivation
  const data = await controller.provider.load();
  assert.deepEqual(data.entries, {});
});

test("deactivate rejects when no active session", () => {
  const controller = createOverrideSessionProvider({
    timer: createFakeTimer().impl,
  });

  assert.throws(
    () => controller.deactivate(),
    { message: "No active session" },
  );
});

test("extend resets timer and updates expiresAt", () => {
  const fakeTimer = createFakeTimer();
  const controller = createOverrideSessionProvider({
    timer: fakeTimer.impl,
    defaultDurationMs: 60_000,
  });

  const original = controller.activate({ reason: "test" });
  const originalExpires = new Date(original.expiresAt).getTime();

  // Extend with a longer duration
  const extended = controller.extend(120_000);
  const extendedExpires = new Date(extended.expiresAt).getTime();

  assert.ok(extendedExpires > originalExpires, "expiresAt should be later after extend");
  assert.equal(extended.id, original.id, "session id should remain the same");

  controller.dispose();
});

test("extend rejects when no active session", () => {
  const controller = createOverrideSessionProvider({
    timer: createFakeTimer().impl,
  });

  assert.throws(
    () => controller.extend(),
    { message: "No active session" },
  );
});

test("provider implements ConfigurationStorageProvider (read/write/remove)", async () => {
  const controller = createOverrideSessionProvider({
    timer: createFakeTimer().impl,
  });

  controller.activate({ reason: "test" });

  const { provider } = controller;

  // Verify provider interface — defaults
  assert.equal(provider.id, "override-session");
  assert.equal(provider.layer, "session");
  assert.equal(provider.writable, true);

  // Write
  const writeResult = await provider.write("ghost.app.theme", "dark");
  assert.equal(writeResult.success, true);

  // Read
  const data = await provider.load();
  assert.equal(data.entries["ghost.app.theme"], "dark");

  // Remove
  const removeResult = await provider.remove("ghost.app.theme");
  assert.equal(removeResult.success, true);

  const dataAfter = await provider.load();
  assert.equal(dataAfter.entries["ghost.app.theme"], undefined);

  controller.dispose();
});

test("session overrides are cleared on deactivate", async () => {
  const controller = createOverrideSessionProvider({
    timer: createFakeTimer().impl,
  });

  controller.activate({ reason: "test" });
  await controller.provider.write("a", 1);
  await controller.provider.write("b", 2);
  await controller.provider.write("c", 3);

  // Session should track overrides
  const session = controller.getSession();
  assert.deepEqual(session.overrides, { a: 1, b: 2, c: 3 });

  controller.deactivate();

  // Provider storage should be empty
  const data = await controller.provider.load();
  assert.deepEqual(data.entries, {});
});

test("auto-expire triggers deactivation after timer fires", async () => {
  const fakeTimer = createFakeTimer();
  const auditLog = [];
  const controller = createOverrideSessionProvider({
    timer: fakeTimer.impl,
    defaultDurationMs: 5_000,
    onAudit: (entry) => auditLog.push(entry),
  });

  controller.activate({ reason: "test" });
  await controller.provider.write("key", "value");

  assert.equal(controller.isActive(), true);

  // Fire the expiration timer
  fakeTimer.fire();

  assert.equal(controller.isActive(), false);
  assert.equal(controller.getSession(), null);

  // Storage should be cleared
  const data = await controller.provider.load();
  assert.deepEqual(data.entries, {});

  // Should have emitted expire audit
  const expireEvent = auditLog.find((e) => e.action === "expire");
  assert.ok(expireEvent, "should have emitted expire audit event");
  assert.equal(expireEvent.details.overridesCleared, 1);
});

test("audit events emitted for activate/deactivate/extend/expire", async () => {
  const fakeTimer = createFakeTimer();
  const auditLog = [];
  const controller = createOverrideSessionProvider({
    timer: fakeTimer.impl,
    defaultDurationMs: 5_000,
    onAudit: (entry) => auditLog.push(entry),
  });

  // activate
  controller.activate({ reason: "audit-test" });
  assert.equal(auditLog.length, 1);
  assert.equal(auditLog[0].action, "activate");
  assert.ok(auditLog[0].sessionId);
  assert.ok(auditLog[0].timestamp);

  // extend
  controller.extend(10_000);
  assert.equal(auditLog.length, 2);
  assert.equal(auditLog[1].action, "extend");

  // deactivate
  controller.deactivate();
  assert.equal(auditLog.length, 3);
  assert.equal(auditLog[2].action, "deactivate");

  // Re-activate then expire
  controller.activate({ reason: "expire-test" });
  fakeTimer.fire();
  assert.equal(auditLog.length, 5); // +activate, +expire
  assert.equal(auditLog[4].action, "expire");
});

test("dispose clears timer and deactivates", async () => {
  const fakeTimer = createFakeTimer();
  const auditLog = [];
  const controller = createOverrideSessionProvider({
    timer: fakeTimer.impl,
    onAudit: (entry) => auditLog.push(entry),
  });

  controller.activate({ reason: "test" });
  await controller.provider.write("k", "v");

  controller.dispose();

  assert.equal(controller.isActive(), false);
  assert.equal(controller.getSession(), null);

  // Should have emitted deactivate audit
  const deactivateEvent = auditLog.find((e) => e.action === "deactivate");
  assert.ok(deactivateEvent, "dispose should emit deactivate audit");

  // Timer should not fire after dispose (fire should be no-op)
  fakeTimer.fire();
  assert.equal(controller.isActive(), false);
});

test("custom durationMs in activation request", () => {
  const fakeTimer = createFakeTimer();
  const controller = createOverrideSessionProvider({
    timer: fakeTimer.impl,
    defaultDurationMs: 60_000,
  });

  controller.activate({ reason: "custom", durationMs: 30_000 });

  assert.equal(fakeTimer.scheduledMs, 30_000);

  controller.dispose();
});

test("getSession returns null when no session, returns session when active", () => {
  const controller = createOverrideSessionProvider({
    timer: createFakeTimer().impl,
  });

  assert.equal(controller.getSession(), null);

  controller.activate({ reason: "test" });

  const session = controller.getSession();
  assert.ok(session !== null);
  assert.equal(session.reason, "test");
  assert.equal(session.isActive, true);

  controller.dispose();
});

test("default duration is 4 hours", () => {
  const fakeTimer = createFakeTimer();
  const controller = createOverrideSessionProvider({
    timer: fakeTimer.impl,
  });

  controller.activate({ reason: "test" });

  assert.equal(fakeTimer.scheduledMs, 4 * 60 * 60 * 1000);

  controller.dispose();
});

test("deactivate returns auditRecorded false when no onAudit", () => {
  const controller = createOverrideSessionProvider({
    timer: createFakeTimer().impl,
  });

  controller.activate({ reason: "test" });
  const result = controller.deactivate();

  assert.equal(result.auditRecorded, false);
});

test("provider load returns snapshot (not live reference)", async () => {
  const controller = createOverrideSessionProvider({
    timer: createFakeTimer().impl,
  });

  controller.activate({ reason: "test" });
  await controller.provider.write("key", "value");

  const data1 = await controller.provider.load();
  data1.entries.key = "mutated";

  const data2 = await controller.provider.load();
  assert.equal(data2.entries.key, "value");

  controller.dispose();
});

test("extend without duration uses current duration", () => {
  const fakeTimer = createFakeTimer();
  const controller = createOverrideSessionProvider({
    timer: fakeTimer.impl,
    defaultDurationMs: 60_000,
  });

  controller.activate({ reason: "test", durationMs: 30_000 });
  assert.equal(fakeTimer.scheduledMs, 30_000);

  // Extend without specifying duration should use the current (30s)
  controller.extend();
  assert.equal(fakeTimer.scheduledMs, 30_000);

  controller.dispose();
});

test("custom layer and id options", () => {
  const controller = createOverrideSessionProvider({
    timer: createFakeTimer().impl,
    layer: "custom-session",
    id: "my-session-provider",
  });

  controller.activate({ reason: "test" });

  const { provider } = controller;
  assert.equal(provider.id, "my-session-provider");
  assert.equal(provider.layer, "custom-session");

  controller.dispose();
});
