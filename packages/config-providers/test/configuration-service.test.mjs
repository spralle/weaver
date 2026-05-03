import test from "node:test";
import assert from "node:assert/strict";
import {
  createConfigurationService,
} from "../dist/configuration-service.js";
import {
  StaticJsonStorageProvider,
} from "../dist/static-json-provider.js";
import {
  InMemoryStorageProvider,
} from "../dist/in-memory-provider.js";
import { defineWeaver, Layers } from "@weaver/config-types";

const testConfig = defineWeaver([
  Layers.Static("core"),
  Layers.Static("app"),
  Layers.Static("module"),
  Layers.Static("integrator"),
  Layers.Dynamic("tenant"),
  Layers.Personal("user"),
  Layers.Personal("device"),
  Layers.Ephemeral("session"),
]);

test("create service with core + session: get returns merged value", async () => {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {
      "ghost.app.theme": "light",
      "ghost.app.zoom": 3,
    },
  });
  const session = new InMemoryStorageProvider({
    id: "session",
    layer: "session",
    initialEntries: { "ghost.app.theme": "dark" },
  });
  const svc = await createConfigurationService({ providers: [session, core], weaverConfig: testConfig });
  assert.equal(svc.get("ghost.app.theme"), "dark");
  assert.equal(svc.get("ghost.app.zoom"), 3);
});

test("core key is returned when no override", async () => {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: { "ghost.app.lang": "en" },
  });
  const svc = await createConfigurationService({ providers: [core], weaverConfig: testConfig });
  assert.equal(svc.get("ghost.app.lang"), "en");
});

test("session key overrides core key", async () => {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: { "ghost.app.lang": "en" },
  });
  const session = new InMemoryStorageProvider({
    id: "session",
    layer: "session",
    initialEntries: { "ghost.app.lang": "no" },
  });
  const svc = await createConfigurationService({ providers: [core, session], weaverConfig: testConfig });
  assert.equal(svc.get("ghost.app.lang"), "no");
});

test("getWithDefault returns default when key missing", async () => {
  const svc = await createConfigurationService({
    providers: [
      new StaticJsonStorageProvider({ id: "core", layer: "core", data: {} }),
    ],
    weaverConfig: testConfig,
  });
  assert.equal(svc.getWithDefault("ghost.app.missing", 42), 42);
});

test("getWithDefault returns value when key exists", async () => {
  const svc = await createConfigurationService({
    providers: [
      new StaticJsonStorageProvider({
        id: "core",
        layer: "core",
        data: { "ghost.app.zoom": 5 },
      }),
    ],
    weaverConfig: testConfig,
  });
  assert.equal(svc.getWithDefault("ghost.app.zoom", 42), 5);
});

test("getAtLayer returns raw layer value", async () => {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: { "ghost.app.theme": "light" },
  });
  const session = new InMemoryStorageProvider({
    id: "session",
    layer: "session",
    initialEntries: { "ghost.app.theme": "dark" },
  });
  const svc = await createConfigurationService({ providers: [core, session], weaverConfig: testConfig });
  assert.equal(svc.getAtLayer("core", "ghost.app.theme"), "light");
  assert.equal(svc.getAtLayer("session", "ghost.app.theme"), "dark");
});

test("set writes to writable provider, get returns new value", async () => {
  const session = new InMemoryStorageProvider({
    id: "session",
    layer: "session",
  });
  const svc = await createConfigurationService({ providers: [session], weaverConfig: testConfig });
  svc.set("ghost.app.zoom", 10);
  assert.equal(svc.get("ghost.app.zoom"), 10);
});

test("set to read-only layer throws", async () => {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {},
  });
  const svc = await createConfigurationService({ providers: [core], weaverConfig: testConfig });
  assert.throws(
    () => svc.set("ghost.app.zoom", 10, "core"),
    /No writable provider for layer "core"/,
  );
});

test("set without layer uses highest writable provider", async () => {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {},
  });
  const session = new InMemoryStorageProvider({
    id: "session",
    layer: "session",
  });
  const svc = await createConfigurationService({ providers: [core, session], weaverConfig: testConfig });
  svc.set("ghost.app.color", "red");
  assert.equal(svc.get("ghost.app.color"), "red");
  assert.equal(svc.getAtLayer("session", "ghost.app.color"), "red");
});

test("inspect shows per-layer breakdown", async () => {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: { "ghost.app.theme": "light" },
  });
  const session = new InMemoryStorageProvider({
    id: "session",
    layer: "session",
    initialEntries: { "ghost.app.theme": "dark" },
  });
  const svc = await createConfigurationService({ providers: [core, session], weaverConfig: testConfig });
  const inspection = svc.inspect("ghost.app.theme");
  assert.equal(inspection.key, "ghost.app.theme");
  assert.equal(inspection.effectiveValue, "dark");
  assert.equal(inspection.effectiveLayer, "session");
  assert.equal(inspection.layerValues.core, "light");
  assert.equal(inspection.layerValues.session, "dark");
});

test("onChange fires when set changes a value", async () => {
  const session = new InMemoryStorageProvider({
    id: "session",
    layer: "session",
  });
  const svc = await createConfigurationService({ providers: [session], weaverConfig: testConfig });

  const changes = [];
  svc.onChange("ghost.app.zoom", (v) => changes.push(v));
  svc.set("ghost.app.zoom", 7);
  assert.deepEqual(changes, [7]);
});

test("getNamespace returns matching keys", async () => {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {
      "ghost.app.theme": "dark",
      "ghost.app.zoom": 5,
      "ghost.nav.width": 200,
    },
  });
  const svc = await createConfigurationService({ providers: [core], weaverConfig: testConfig });
  const ns = svc.getNamespace("ghost.app");
  assert.deepEqual(ns, {
    "ghost.app.theme": "dark",
    "ghost.app.zoom": 5,
  });
});

test("remove deletes from writable layer", async () => {
  const session = new InMemoryStorageProvider({
    id: "session",
    layer: "session",
    initialEntries: { "ghost.app.zoom": 5 },
  });
  const svc = await createConfigurationService({ providers: [session], weaverConfig: testConfig });
  assert.equal(svc.get("ghost.app.zoom"), 5);
  svc.remove("ghost.app.zoom", "session");
  assert.equal(svc.get("ghost.app.zoom"), undefined);
});

test("remove from read-only layer throws", async () => {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: { "ghost.app.zoom": 5 },
  });
  const svc = await createConfigurationService({ providers: [core], weaverConfig: testConfig });
  assert.throws(
    () => svc.remove("ghost.app.zoom", "core"),
    /No writable provider for layer "core"/,
  );
});

test("getForScope resolves with tenant -> scope-chain -> user precedence", async () => {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: { "ghost.app.theme": "light" },
  });
  const tenant = new InMemoryStorageProvider({
    id: "tenant",
    layer: "tenant",
    initialEntries: { "ghost.app.theme": "tenant" },
  });
  const region = new InMemoryStorageProvider({
    id: "region-eu",
    layer: "region:europe",
    initialEntries: { "ghost.app.theme": "region" },
  });
  const port = new InMemoryStorageProvider({
    id: "port-rtm",
    layer: "port:rotterdam",
    initialEntries: { "ghost.app.theme": "port" },
  });
  const user = new InMemoryStorageProvider({
    id: "user",
    layer: "user",
    initialEntries: { "ghost.app.theme": "user" },
  });

  const svc = await createConfigurationService({
    providers: [user, port, core, region, tenant],
    weaverConfig: testConfig,
  });

  assert.equal(
    svc.getForScope("ghost.app.theme", [
      { scopeId: "region", value: "europe" },
      { scopeId: "port", value: "rotterdam" },
    ]),
    "user",
  );
});

test("getForScope falls back when narrower dynamic scope layer is missing", async () => {
  const tenant = new InMemoryStorageProvider({
    id: "tenant",
    layer: "tenant",
    initialEntries: { "ghost.app.zoom": 3 },
  });
  const region = new InMemoryStorageProvider({
    id: "region-eu",
    layer: "region:europe",
    initialEntries: { "ghost.app.zoom": 5 },
  });

  const svc = await createConfigurationService({ providers: [tenant, region], weaverConfig: testConfig });

  assert.equal(
    svc.getForScope("ghost.app.zoom", [
      { scopeId: "region", value: "europe" },
      { scopeId: "port", value: "rotterdam" },
    ]),
    5,
  );
});

test("getForScope falls back to tenant when no matching scope layers exist", async () => {
  const tenant = new InMemoryStorageProvider({
    id: "tenant",
    layer: "tenant",
    initialEntries: { "ghost.app.units": "metric" },
  });
  const region = new InMemoryStorageProvider({
    id: "region-eu",
    layer: "region:europe",
    initialEntries: { "ghost.app.units": "nautical" },
  });

  const svc = await createConfigurationService({ providers: [tenant, region], weaverConfig: testConfig });

  assert.equal(
    svc.getForScope("ghost.app.units", [{ scopeId: "region", value: "asia" }]),
    "metric",
  );
});

test("get remains unchanged and can include out-of-scope dynamic providers", async () => {
  const tenant = new InMemoryStorageProvider({
    id: "tenant",
    layer: "tenant",
    initialEntries: { "ghost.app.locale": "en" },
  });
  const regionEurope = new InMemoryStorageProvider({
    id: "region-eu",
    layer: "region:europe",
    initialEntries: { "ghost.app.locale": "nb" },
  });
  const regionAsia = new InMemoryStorageProvider({
    id: "region-asia",
    layer: "region:asia",
    initialEntries: { "ghost.app.locale": "ja" },
  });

  const svc = await createConfigurationService({
    providers: [tenant, regionEurope, regionAsia],
    weaverConfig: testConfig,
  });

  assert.equal(svc.get("ghost.app.locale"), "ja");
  assert.equal(
    svc.getForScope("ghost.app.locale", [{ scopeId: "region", value: "europe" }]),
    "nb",
  );
});

// --- Mount resolution integration tests ---

test("get() resolves ConfigMount to source value", async () => {
  const provider = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {
      "app.db.host": "real-host",
      "app.alias.host": { _weaver: "mount", source: "app.db.host" },
    },
  });
  const svc = await createConfigurationService({ providers: [provider], weaverConfig: testConfig });
  assert.equal(svc.get("app.alias.host"), "real-host");
});

test("get() resolves chained mounts A→B→C", async () => {
  const provider = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {
      "a": { _weaver: "mount", source: "b" },
      "b": { _weaver: "mount", source: "c" },
      "c": "final-value",
    },
  });
  const svc = await createConfigurationService({ providers: [provider], weaverConfig: testConfig });
  assert.equal(svc.get("a"), "final-value");
});

test("get() returns undefined for mount cycle", async () => {
  const provider = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {
      "a": { _weaver: "mount", source: "b" },
      "b": { _weaver: "mount", source: "a" },
    },
  });
  const svc = await createConfigurationService({ providers: [provider], weaverConfig: testConfig });
  assert.equal(svc.get("a"), undefined);
});

test("getWithDefault() falls back on mount error", async () => {
  const provider = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {
      "x": { _weaver: "mount", source: "y" },
      "y": { _weaver: "mount", source: "x" },
    },
  });
  const svc = await createConfigurationService({ providers: [provider], weaverConfig: testConfig });
  assert.equal(svc.getWithDefault("x", "fallback"), "fallback");
});

test("getNamespace() resolves mounts in namespace", async () => {
  const provider = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {
      "ns.real": "value",
      "ns.alias": { _weaver: "mount", source: "ns.real" },
      "ns.plain": 42,
    },
  });
  const svc = await createConfigurationService({ providers: [provider], weaverConfig: testConfig });
  const ns = svc.getNamespace("ns");
  assert.equal(ns["ns.alias"], "value");
  assert.equal(ns["ns.plain"], 42);
});

test("inspect() includes mountChain for mounted key", async () => {
  const provider = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {
      "a": { _weaver: "mount", source: "b" },
      "b": "resolved",
    },
  });
  const svc = await createConfigurationService({ providers: [provider], weaverConfig: testConfig });
  const inspection = svc.inspect("a");
  assert.deepEqual(inspection.mountChain, ["a", "b"]);
  assert.equal(inspection.effectiveValue, "resolved");
});

test("mount map rebuilds on layer change", async () => {
  const mem = new InMemoryStorageProvider({
    id: "session",
    layer: "session",
    initialEntries: {
      "k": { _weaver: "mount", source: "target" },
      "target": "mounted-value",
    },
  });
  const svc = await createConfigurationService({ providers: [mem], weaverConfig: testConfig });
  assert.equal(svc.get("k"), "mounted-value");

  // Remove the mount by overwriting with a plain value
  svc.set("k", "direct-value");
  assert.equal(svc.get("k"), "direct-value");
});
