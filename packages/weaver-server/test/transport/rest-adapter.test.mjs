import { test, describe } from "bun:test";
import assert from "node:assert/strict";
import { createWeaverConfigService } from "../../src/core/config-service.ts";
import { createRestAdapter } from "../../src/transport/rest-adapter.ts";

function createTestProvider(id, layer, entries, writable = true) {
  let data = { ...entries };
  return {
    id,
    layer,
    writable,
    async load() { return { entries: { ...data } }; },
    async write(key, value) {
      data[key] = value;
      return { success: true };
    },
    async remove(key) {
      delete data[key];
      return { success: true };
    },
  };
}

async function setup(opts = {}) {
  const provider = createTestProvider("p1", "platform", { "app.name": "test", "db.host": "localhost" });
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
    assert.equal(res.body.data.entries["app.name"], "test");
  });

  test("GET /v1/config with ?prefix= filters entries", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/v1/config", req({ query: { prefix: "db" } }));
    assert.equal(res.status, 200);
    assertEnvelope(res.body);
    assert.ok(res.body.data.entries["db.host"]);
    assert.equal(res.body.data.entries["app.name"], undefined);
  });

  test("GET /v1/config with ?scope= passes scope", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/v1/config", req({ query: { scope: "tenant:acme" } }));
    assert.equal(res.status, 200);
    assertEnvelope(res.body);
  });

  test("GET /v1/config/:key returns value in envelope", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/v1/config/app.name", req());
    assert.equal(res.status, 200);
    assertEnvelope(res.body);
    assertV1Headers(res);
    assert.equal(res.body.data.key, "app.name");
    assert.equal(res.body.data.value, "test");
  });

  test("GET /v1/config/:key?inspect returns inspection", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/v1/config/app.name", req({ query: { inspect: "" } }));
    assert.equal(res.status, 200);
    assertEnvelope(res.body);
    assert.equal(res.body.data.key, "app.name");
    assert.ok(res.body.data.layerValues);
  });

  test("PUT /v1/config/:key sets value", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("PUT", "/v1/config/new.key", req({ body: { value: 42 }, query: { layer: "platform" } }));
    assert.equal(res.status, 200);
    assertEnvelope(res.body);
    assertV1Headers(res);
    assert.equal(res.body.data.success, true);
  });

  test("PUT /v1/config/:key defaults layer to platform", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("PUT", "/v1/config/new.key", req({ body: { value: 42 } }));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.success, true);
  });

  test("DELETE /v1/config/:key removes value", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("DELETE", "/v1/config/app.name", req({ query: { layer: "platform" } }));
    assert.equal(res.status, 200);
    assertEnvelope(res.body);
    assertV1Headers(res);
    assert.equal(res.body.data.success, true);
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

  test("admin stub routes return 501 with envelope", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("POST", "/v1/admin/promote", req());
    assert.equal(res.status, 501);
    assertEnvelope(res.body);
    assertV1Headers(res);
  });

  test("scope routes return envelope", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/v1/scopes", req());
    assert.equal(res.status, 200);
    assertEnvelope(res.body);
    assertV1Headers(res);
  });

  test("session routes return 501 with envelope", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("POST", "/v1/admin/sessions", req());
    assert.equal(res.status, 501);
    assertEnvelope(res.body);
  });

  test("events route returns 501 with envelope", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/v1/events", req());
    assert.equal(res.status, 501);
    assertEnvelope(res.body);
  });

  test("ETag header present on all responses", async () => {
    const { adapter } = await setup();
    const endpoints = [
      ["GET", "/v1/config"],
      ["GET", "/v1/config/app.name"],
      ["GET", "/v1/scopes"],
    ];
    for (const [method, path] of endpoints) {
      const res = await adapter.handleRequest(method, path, req());
      assertETag(res);
    }
  });
});
