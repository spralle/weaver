import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createConfigurationService } from "../dist/configuration-service.js";
import { createInMemoryStorageProvider } from "../../storage-provider-memory/dist/index.js";
import { defineWeaver, Layers } from "@weaver/config-types";

const testConfig = defineWeaver([
  Layers.Static("core"),
  Layers.Ephemeral("session"),
]);

function makeProvider(layer, entries) {
  return createInMemoryStorageProvider({ id: layer, layer, initialEntries: entries });
}

test("get with Zod schema returns validated value", async () => {
  const provider = makeProvider("core", { "app.port": 3000 });
  const svc = await createConfigurationService({ providers: [provider], weaverConfig: testConfig });
  const result = svc.get("app.port", z.number());
  assert.equal(result, 3000);
});

test("get with Zod schema returns undefined for invalid value", async () => {
  const provider = makeProvider("core", { "app.port": "not-a-number" });
  const svc = await createConfigurationService({ providers: [provider], weaverConfig: testConfig });
  const result = svc.get("app.port", z.number());
  assert.equal(result, undefined);
});

test("get with Zod schema returns undefined for missing key", async () => {
  const provider = makeProvider("core", {});
  const svc = await createConfigurationService({ providers: [provider], weaverConfig: testConfig });
  const result = svc.get("missing.key", z.string());
  assert.equal(result, undefined);
});

test("get without schema still works (backward compat)", async () => {
  const provider = makeProvider("core", { "app.name": "weaver" });
  const svc = await createConfigurationService({ providers: [provider], weaverConfig: testConfig });
  assert.equal(svc.get("app.name"), "weaver");
});

test("get with complex Zod schema validates object shape", async () => {
  const provider = makeProvider("core", {
    "app.settings": { host: "localhost", port: 8080 },
  });
  const svc = await createConfigurationService({ providers: [provider], weaverConfig: testConfig });
  const schema = z.object({ host: z.string(), port: z.number() });
  const result = svc.get("app.settings", schema);
  assert.deepEqual(result, { host: "localhost", port: 8080 });
});
