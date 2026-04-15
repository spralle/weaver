import test from "node:test";
import assert from "node:assert/strict";
import { createConfigurationService } from "../dist/configuration-service.js";
import { createViewConfigurationService } from "../dist/view-service.js";
import { InMemoryStorageProvider } from "../dist/in-memory-provider.js";
import { StaticJsonStorageProvider } from "../dist/static-json-provider.js";

async function makeService(coreData, sessionData = {}) {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: coreData,
  });
  const session = new InMemoryStorageProvider({
    id: "session",
    layer: "session",
    initialEntries: sessionData,
  });
  return createConfigurationService({ providers: [core, session] });
}

test("get reads base view config key", async () => {
  const svc = await makeService({
    "ghost.vesselView.mapPanel.showGrid": true,
    "ghost.vesselView.mapPanel.zoom": 5,
  });
  const view = createViewConfigurationService(svc, "ghost.vesselView", "mapPanel");
  assert.equal(view.get("showGrid"), true);
  assert.equal(view.get("zoom"), 5);
});

test("getWithDefault returns default when key missing", async () => {
  const svc = await makeService({});
  const view = createViewConfigurationService(svc, "ghost.vesselView", "mapPanel");
  assert.equal(view.getWithDefault("zoom", 10), 10);
});

test("getWithDefault returns value when present", async () => {
  const svc = await makeService({
    "ghost.vesselView.mapPanel.zoom": 7,
  });
  const view = createViewConfigurationService(svc, "ghost.vesselView", "mapPanel");
  assert.equal(view.getWithDefault("zoom", 10), 7);
});

test("getForInstance returns instance override when present", async () => {
  const svc = await makeService(
    { "ghost.vesselView.mapPanel.zoom": 5 },
    { "ghost.vesselView.mapPanel.__instance__.inst1.zoom": 12 },
  );
  const view = createViewConfigurationService(svc, "ghost.vesselView", "mapPanel");
  assert.equal(view.getForInstance("inst1", "zoom"), 12);
});

test("getForInstance falls back to base when no instance override", async () => {
  const svc = await makeService({
    "ghost.vesselView.mapPanel.zoom": 5,
  });
  const view = createViewConfigurationService(svc, "ghost.vesselView", "mapPanel");
  assert.equal(view.getForInstance("inst1", "zoom"), 5);
});

test("setForInstance writes to instance key pattern", async () => {
  const svc = await makeService({ "ghost.vesselView.mapPanel.zoom": 5 });
  const view = createViewConfigurationService(svc, "ghost.vesselView", "mapPanel");
  view.setForInstance("inst1", "zoom", 20);
  assert.equal(view.getForInstance("inst1", "zoom"), 20);
  // Base value unchanged
  assert.equal(view.get("zoom"), 5);
});

test("resetInstance clears instance overrides", async () => {
  const svc = await makeService(
    { "ghost.vesselView.mapPanel.zoom": 5 },
    {
      "ghost.vesselView.mapPanel.__instance__.inst1.zoom": 20,
      "ghost.vesselView.mapPanel.__instance__.inst1.showGrid": true,
    },
  );
  const view = createViewConfigurationService(svc, "ghost.vesselView", "mapPanel");
  assert.equal(view.getForInstance("inst1", "zoom"), 20);
  assert.equal(view.getForInstance("inst1", "showGrid"), true);

  view.resetInstance("inst1");

  // Falls back to base
  assert.equal(view.getForInstance("inst1", "zoom"), 5);
  // showGrid has no base value, so undefined
  assert.equal(view.getForInstance("inst1", "showGrid"), undefined);
});

test("multiple instances are independent", async () => {
  const svc = await makeService({ "ghost.vesselView.mapPanel.zoom": 5 });
  const view = createViewConfigurationService(svc, "ghost.vesselView", "mapPanel");
  view.setForInstance("inst1", "zoom", 10);
  view.setForInstance("inst2", "zoom", 20);
  assert.equal(view.getForInstance("inst1", "zoom"), 10);
  assert.equal(view.getForInstance("inst2", "zoom"), 20);
});
