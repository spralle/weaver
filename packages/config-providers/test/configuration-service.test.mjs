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
  const svc = await createConfigurationService({ providers: [session, core] });
  assert.equal(svc.get("ghost.app.theme"), "dark");
  assert.equal(svc.get("ghost.app.zoom"), 3);
});

test("core key is returned when no override", async () => {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: { "ghost.app.lang": "en" },
  });
  const svc = await createConfigurationService({ providers: [core] });
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
  const svc = await createConfigurationService({ providers: [core, session] });
  assert.equal(svc.get("ghost.app.lang"), "no");
});

test("getWithDefault returns default when key missing", async () => {
  const svc = await createConfigurationService({
    providers: [
      new StaticJsonStorageProvider({ id: "core", layer: "core", data: {} }),
    ],
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
  const svc = await createConfigurationService({ providers: [core, session] });
  assert.equal(svc.getAtLayer("core", "ghost.app.theme"), "light");
  assert.equal(svc.getAtLayer("session", "ghost.app.theme"), "dark");
});

test("set writes to writable provider, get returns new value", async () => {
  const session = new InMemoryStorageProvider({
    id: "session",
    layer: "session",
  });
  const svc = await createConfigurationService({ providers: [session] });
  svc.set("ghost.app.zoom", 10);
  assert.equal(svc.get("ghost.app.zoom"), 10);
});

test("set to read-only layer throws", async () => {
  const core = new StaticJsonStorageProvider({
    id: "core",
    layer: "core",
    data: {},
  });
  const svc = await createConfigurationService({ providers: [core] });
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
  const svc = await createConfigurationService({ providers: [core, session] });
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
  const svc = await createConfigurationService({ providers: [core, session] });
  const inspection = svc.inspect("ghost.app.theme");
  assert.equal(inspection.key, "ghost.app.theme");
  assert.equal(inspection.effectiveValue, "dark");
  assert.equal(inspection.effectiveLayer, "session");
  assert.equal(inspection.coreValue, "light");
  assert.equal(inspection.sessionValue, "dark");
});

test("onChange fires when set changes a value", async () => {
  const session = new InMemoryStorageProvider({
    id: "session",
    layer: "session",
  });
  const svc = await createConfigurationService({ providers: [session] });

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
  const svc = await createConfigurationService({ providers: [core] });
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
  const svc = await createConfigurationService({ providers: [session] });
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
  const svc = await createConfigurationService({ providers: [core] });
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

  const svc = await createConfigurationService({ providers: [tenant, region] });

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

  const svc = await createConfigurationService({ providers: [tenant, region] });

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
  });

  assert.equal(svc.get("ghost.app.locale"), "ja");
  assert.equal(
    svc.getForScope("ghost.app.locale", [{ scopeId: "region", value: "europe" }]),
    "nb",
  );
});
