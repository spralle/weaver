import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createWeaverConfigService } from "../../src/core/config-service.ts";
import { createRestAdapter } from "../../src/transport/rest-adapter.ts";
import { deepSet, deepRemove } from "@weaver/config-engine";

function createTestProvider(id, layer, entries, writable = true) {
  let data = JSON.parse(JSON.stringify(entries));
  return {
    id,
    layer,
    writable,
    async load() { return { entries: JSON.parse(JSON.stringify(data)) }; },
    async write(key, value) {
      deepSet(data, key, value);
      return { success: true };
    },
    async remove(key) {
      deepRemove(data, key);
      return { success: true };
    },
  };
}

async function setup(opts = {}) {
  const provider = createTestProvider("p1", "platform", { app: { name: "test" }, db: { host: "localhost" } });
  const svc = await createWeaverConfigService({ providers: [provider], environment: "dev" });
  const adapter = createRestAdapter({ configService: svc, ...opts });
  return { svc, adapter };
}

function req(overrides = {}) {
  return { params: {}, query: {}, headers: {}, ...overrides };
}

function assertEnvelope(body) {
  assert.ok(body.data !== undefined, "response must have data field");
  assert.ok(body.meta, "response must have meta field");
  assert.ok(body.meta.revision, "meta must have revision");
  assert.ok(body.meta.timestamp, "meta must have timestamp");
}

function assertETag(res) {
  assert.ok(res.headers?.["ETag"], "response must have ETag header");
  assert.ok(res.headers["ETag"].startsWith('"'), "ETag must be quoted");
}

function assertCacheControl(res) {
  assert.equal(res.headers?.["Cache-Control"], "no-cache");
}

function assertV1Headers(res) {
  assertETag(res);
  assertCacheControl(res);
  assert.equal(res.headers["Content-Type"], "application/json");
}

describe("RestAdapter v1", () => {
  test("GET /v1/config returns snapshot in envelope", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/v1/config", req());
    assert.equal(res.status, 200);
    assertEnvelope(res.body);
    assertV1Headers(res);
    assert.equal(res.body.data.entries.app.name, "test");
  });

  test("GET /v1/config with ?scope= passes scope", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/v1/config", req({ query: { scope: "tenant:acme" } }));
    assert.equal(res.status, 200);
    assertEnvelope(res.body);
  });

  test("GET /v1/config/app/name returns value via path segments", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/v1/config/app/name", req());
    assert.equal(res.status, 200);
    assertEnvelope(res.body);
    assertV1Headers(res);
    assert.equal(res.body.data.key, "app.name");
    assert.equal(res.body.data.value, "test");
  });

  test("GET /v1/config/app/name?inspect returns inspection", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/v1/config/app/name", req({ query: { inspect: "" } }));
    assert.equal(res.status, 200);
    assertEnvelope(res.body);
    assert.equal(res.body.data.key, "app.name");
    assert.ok(res.body.data.layerValues);
  });

  test("PUT /v1/config/new/key sets value", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("PUT", "/v1/config/new/key", req({ body: { value: 42 }, query: { layer: "platform" } }));
    assert.equal(res.status, 200);
    assertEnvelope(res.body);
    assertV1Headers(res);
    assert.equal(res.body.data.success, true);
  });

  test("PUT /v1/config/new/key defaults layer to platform", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("PUT", "/v1/config/new/key", req({ body: { value: 42 } }));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.success, true);
  });

  test("DELETE /v1/config/app/name removes value", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("DELETE", "/v1/config/app/name", req({ query: { layer: "platform" } }));
    assert.equal(res.status, 200);
    assertEnvelope(res.body);
    assertV1Headers(res);
    assert.equal(res.body.data.success, true);
  });

  test("GET /v1/config/db returns subtree as value", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/v1/config/db", req());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.key, "db");
    assert.deepEqual(res.body.data.value, { host: "localhost" });
  });

  test("404 for unknown routes has envelope", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/api/unknown", req());
    assert.equal(res.status, 404);
    assertEnvelope(res.body);
    assert.equal(res.body.data, null);
    assert.ok(res.body.error);
    assertV1Headers(res);
  });

  test("error responses use envelope with error field", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("PUT", "/v1/config/key", req({ body: { value: 1 }, query: { layer: "nope" } }));
    assert.equal(res.status, 400);
    assertEnvelope(res.body);
    assert.ok(res.body.error);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  test("CORS headers when configured", async () => {
    const { adapter } = await setup({ corsOrigins: ["http://localhost:3000"] });
    const res = await adapter.handleRequest("GET", "/v1/config", req());
    assert.ok(res.headers["Access-Control-Allow-Origin"]);
  });

  test("scope routes return envelope", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/v1/scopes", req());
    assert.equal(res.status, 200);
    assertEnvelope(res.body);
    assertV1Headers(res);
  });


  test("ETag header present on all responses", async () => {
    const { adapter } = await setup();
    const endpoints = [
      ["GET", "/v1/config"],
      ["GET", "/v1/config/app/name"],
      ["GET", "/v1/scopes"],
    ];
    for (const [method, path] of endpoints) {
      const res = await adapter.handleRequest(method, path, req());
      assertETag(res);
    }
  });

  test("PATCH /v1/config writes multiple entries", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("PATCH", "/v1/config", req({
      body: { entries: { "db.host": "newhost", "db.port": 5432 } },
    }));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.success, true);
    assert.equal(res.body.data.written, 2);
  });

  test("PATCH /v1/config returns 400 when entries missing", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("PATCH", "/v1/config", req({
      body: {},
    }));
    assert.equal(res.status, 400);
  });
});
