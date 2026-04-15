import test from "node:test";
import assert from "node:assert/strict";
import { createConfigurationService } from "../dist/configuration-service.js";
import { createScopedConfigurationService } from "../dist/scoped-service.js";
import { InMemoryStorageProvider } from "../dist/in-memory-provider.js";
import { StaticJsonStorageProvider } from "../dist/static-json-provider.js";

async function makeService(entries) {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: entries,
  });
  const session = new InMemoryStorageProvider({
    id: "session",
    layer: "session",
  });
  return createConfigurationService({ providers: [core, session] });
}

test("get qualifies key with namespace", async () => {
  const svc = await makeService({
    "ghost.vesselView.map.zoom": 5,
  });
  const scoped = createScopedConfigurationService(svc, "ghost.vesselView");
  assert.equal(scoped.get("map.zoom"), 5);
});

test("get returns undefined for missing key", async () => {
  const svc = await makeService({});
  const scoped = createScopedConfigurationService(svc, "ghost.vesselView");
  assert.equal(scoped.get("map.zoom"), undefined);
});

test("getWithDefault works with relative key", async () => {
  const svc = await makeService({});
  const scoped = createScopedConfigurationService(svc, "ghost.vesselView");
  assert.equal(scoped.getWithDefault("map.zoom", 10), 10);
});

test("getWithDefault returns value when present", async () => {
  const svc = await makeService({
    "ghost.vesselView.map.zoom": 7,
  });
  const scoped = createScopedConfigurationService(svc, "ghost.vesselView");
  assert.equal(scoped.getWithDefault("map.zoom", 10), 7);
});

test("root accessor returns underlying service", async () => {
  const svc = await makeService({});
  const scoped = createScopedConfigurationService(svc, "ghost.vesselView");
  assert.equal(scoped.root, svc);
});

test("onChange fires for namespace-qualified key", async () => {
  const svc = await makeService({});
  const scoped = createScopedConfigurationService(svc, "ghost.vesselView");

  const changes = [];
  scoped.onChange("map.zoom", (v) => changes.push(v));

  // Write via root service to the qualified key
  svc.set("ghost.vesselView.map.zoom", 12);
  assert.deepEqual(changes, [12]);
});

test("inspect returns inspection for qualified key", async () => {
  const svc = await makeService({
    "ghost.vesselView.map.zoom": 5,
  });
  const scoped = createScopedConfigurationService(svc, "ghost.vesselView");
  const inspection = scoped.inspect("map.zoom");
  assert.equal(inspection.key, "ghost.vesselView.map.zoom");
  assert.equal(inspection.effectiveValue, 5);
  assert.equal(inspection.coreValue, 5);
});

test("getForScope delegates to root with qualified key", async () => {
  const svc = await makeService({
    "ghost.vesselView.map.zoom": 5,
  });
  const scoped = createScopedConfigurationService(svc, "ghost.vesselView");
  const val = scoped.getForScope("map.zoom", [
    { scopeId: "fleet", value: "f1" },
  ]);
  assert.equal(val, 5);
});

test("forView returns a ViewConfigurationService", async () => {
  const svc = await makeService({
    "ghost.vesselView.mapPanel.showGrid": true,
  });
  const scoped = createScopedConfigurationService(svc, "ghost.vesselView");
  const viewSvc = scoped.forView("mapPanel");
  assert.equal(viewSvc.get("showGrid"), true);
});

test("withScope returns scoped service with baked-in scope", async () => {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {
      "ghost.vesselView.map.zoom": 4,
    },
  });
  const region = new InMemoryStorageProvider({
    id: "region-eu",
    layer: "region:europe",
    initialEntries: {
      "ghost.vesselView.map.zoom": 6,
    },
  });
  const port = new InMemoryStorageProvider({
    id: "port-rtm",
    layer: "port:rotterdam",
    initialEntries: {
      "ghost.vesselView.map.zoom": 7,
    },
  });

  const svc = await createConfigurationService({
    providers: [core, region, port],
  });
  const scoped = createScopedConfigurationService(svc, "ghost.vesselView");
  const withScopeService = scoped.withScope([
    { scopeId: "region", value: "europe" },
    { scopeId: "port", value: "rotterdam" },
  ]);

  assert.equal(withScopeService.get("map.zoom"), 7);
  assert.equal(scoped.getForScope("map.zoom", [{ scopeId: "region", value: "europe" }]), 6);
});
