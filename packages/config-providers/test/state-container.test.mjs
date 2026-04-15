import test from "node:test";
import assert from "node:assert/strict";
import { createStateContainer } from "../dist/state-container.js";

const testLayers = ["core","app","module","integrator","tenant","user","device","session"];
const getRank = (l) => { const i = testLayers.indexOf(l); return i >= 0 ? i : testLayers.length; };

test("empty container: get returns undefined", () => {
  const container = createStateContainer(getRank);
  assert.equal(container.get("ghost.app.theme"), undefined);
});

test("empty container: snapshot returns empty frozen object", () => {
  const container = createStateContainer(getRank);
  const snap = container.snapshot();
  assert.deepEqual(snap, {});
  assert.ok(Object.isFrozen(snap));
});

test("single layer: applyLayerData stores and resolves values", () => {
  const container = createStateContainer(getRank);
  container.applyLayerData("core", {
    "ghost.app.theme": "dark",
    "ghost.app.zoom": 5,
  });
  assert.equal(container.get("ghost.app.theme"), "dark");
  assert.equal(container.get("ghost.app.zoom"), 5);
});

test("single layer: provenance tracks layer name", () => {
  const container = createStateContainer(getRank);
  container.applyLayerData("core", { "ghost.app.theme": "dark" });
  assert.equal(container.getProvenance("ghost.app.theme"), "core");
});

test("multi-layer merge: tenant overrides core", () => {
  const container = createStateContainer(getRank);
  container.applyLayerData("core", {
    "ghost.app.theme": "light",
    "ghost.app.zoom": 3,
  });
  container.applyLayerData("tenant", { "ghost.app.theme": "dark" });
  assert.equal(container.get("ghost.app.theme"), "dark");
  assert.equal(container.get("ghost.app.zoom"), 3);
  assert.equal(container.getProvenance("ghost.app.theme"), "tenant");
  assert.equal(container.getProvenance("ghost.app.zoom"), "core");
});

test("listener precision: onChange fires only for changed keys", () => {
  const container = createStateContainer(getRank);
  container.applyLayerData("core", {
    "ghost.app.theme": "dark",
    "ghost.app.zoom": 5,
  });

  const themeChanges = [];
  const zoomChanges = [];
  container.onChange("ghost.app.theme", (v) => themeChanges.push(v));
  container.onChange("ghost.app.zoom", (v) => zoomChanges.push(v));

  // Only change theme
  container.applyLayerData("user", { "ghost.app.theme": "light" });
  assert.deepEqual(themeChanges, ["light"]);
  assert.deepEqual(zoomChanges, []);
});

test("listener unsubscribe: after unsubscribe, listener not called", () => {
  const container = createStateContainer(getRank);
  container.applyLayerData("core", { "ghost.app.theme": "dark" });

  const changes = [];
  const unsub = container.onChange("ghost.app.theme", (v) => changes.push(v));

  container.applyLayerData("user", { "ghost.app.theme": "blue" });
  assert.deepEqual(changes, ["blue"]);

  unsub();

  container.applyLayerData("user", { "ghost.app.theme": "red" });
  assert.deepEqual(changes, ["blue"]); // No new entry
});

test("onAnyChange: fires with array of changed keys", () => {
  const container = createStateContainer(getRank);
  container.applyLayerData("core", { "ghost.app.theme": "dark", "ghost.app.zoom": 5 });

  const allChanges = [];
  container.onAnyChange((changes) => allChanges.push(changes));

  container.applyLayerData("user", { "ghost.app.theme": "light" });
  assert.equal(allChanges.length, 1);
  assert.equal(allChanges[0].length, 1);
  assert.equal(allChanges[0][0].key, "ghost.app.theme");
  assert.equal(allChanges[0][0].newValue, "light");
});

test("onAnyChange unsubscribe works", () => {
  const container = createStateContainer(getRank);
  container.applyLayerData("core", { "ghost.app.theme": "dark" });

  const allChanges = [];
  const unsub = container.onAnyChange((changes) => allChanges.push(changes));

  container.applyLayerData("user", { "ghost.app.theme": "blue" });
  assert.equal(allChanges.length, 1);

  unsub();
  container.applyLayerData("user", { "ghost.app.theme": "red" });
  assert.equal(allChanges.length, 1); // No new entry
});

test("getNamespace: returns matching keys only", () => {
  const container = createStateContainer(getRank);
  container.applyLayerData("core", {
    "ghost.app.theme": "dark",
    "ghost.app.zoom": 5,
    "ghost.nav.width": 200,
  });
  const ns = container.getNamespace("ghost.app");
  assert.deepEqual(ns, {
    "ghost.app.theme": "dark",
    "ghost.app.zoom": 5,
  });
});

test("getLayerEntries: returns raw layer data", () => {
  const container = createStateContainer(getRank);
  container.applyLayerData("core", { "ghost.app.theme": "dark" });
  const raw = container.getLayerEntries("core");
  assert.deepEqual(raw, { "ghost.app.theme": "dark" });
});

test("getLayerEntries: returns empty for unknown layer", () => {
  const container = createStateContainer(getRank);
  assert.deepEqual(container.getLayerEntries("nonexistent"), {});
});

test("snapshot: returns frozen copy that does not affect container", () => {
  const container = createStateContainer(getRank);
  container.applyLayerData("core", { "ghost.app.theme": "dark" });
  const snap = container.snapshot();
  assert.ok(Object.isFrozen(snap));
  assert.throws(() => {
    /** @type {any} */ (snap)["ghost.app.theme"] = "mutated";
  });
  assert.equal(container.get("ghost.app.theme"), "dark");
});

test("no listeners fire when values do not change", () => {
  const container = createStateContainer(getRank);
  container.applyLayerData("core", { "ghost.app.theme": "dark" });

  const changes = [];
  container.onChange("ghost.app.theme", (v) => changes.push(v));

  // Re-apply same data
  container.applyLayerData("core", { "ghost.app.theme": "dark" });
  assert.deepEqual(changes, []);
});

test("layer ordering: session overrides user", () => {
  const container = createStateContainer(getRank);
  container.applyLayerData("user", { "ghost.app.theme": "blue" });
  container.applyLayerData("session", { "ghost.app.theme": "green" });
  assert.equal(container.get("ghost.app.theme"), "green");
  assert.equal(container.getProvenance("ghost.app.theme"), "session");
});
