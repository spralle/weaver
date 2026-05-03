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

describe("RestAdapter", () => {
  test("GET /api/config/:serviceId returns snapshot", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/api/config/svc1", req());
    assert.equal(res.status, 200);
    assert.equal(res.body.platform["app.name"], "test");
  });

  test("GET /api/config/:serviceId/:key returns value", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/api/config/svc1/app.name", req());
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { value: "test" });
  });

  test("PUT /api/config/:layer/:environment/:key sets value", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("PUT", "/api/config/platform/dev/new.key", req({ body: { value: 42 } }));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  test("DELETE /api/config/:layer/:environment/:key removes value", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("DELETE", "/api/config/platform/dev/app.name", req());
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  test("GET /api/config/:serviceId/namespace/:prefix returns namespace", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/api/config/svc1/namespace/db", req());
    assert.equal(res.status, 200);
    assert.ok(res.body.entries["db.host"]);
  });

  test("404 for unknown routes", async () => {
    const { adapter } = await setup();
    const res = await adapter.handleRequest("GET", "/api/unknown", req());
    assert.equal(res.status, 404);
  });

  test("error responses use correct HTTP status codes", async () => {
    const { adapter } = await setup();
    // Try to write to non-existent layer
    const res = await adapter.handleRequest("PUT", "/api/config/nope/dev/key", req({ body: { value: 1 } }));
    assert.equal(res.status, 400);
  });

  test("CORS headers when configured", async () => {
    const { adapter } = await setup({ corsOrigins: ["http://localhost:3000"] });
    const res = await adapter.handleRequest("GET", "/api/config/svc1", req());
    assert.ok(res.headers["Access-Control-Allow-Origin"]);
  });
});
