import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { createHttpTransport } = await import("../src/http-transport.js");

function createMockFetch(responses) {
  const calls = [];
  const mockFn = async (url, init) => {
    calls.push({ url, init });
    const key = `${init?.method ?? "GET"} ${new URL(url).pathname}`;
    const handler = responses[key] ?? responses["*"];
    if (!handler) throw new Error(`No mock for ${key}`);
    const result = typeof handler === "function" ? handler(url, init) : handler;
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status ?? 200,
      json: async () => result.body,
      body: result.stream ?? null,
    };
  };
  return { fetch: mockFn, calls };
}

describe("HttpTransport", () => {
  it("resolveAll makes GET /v1/config", async () => {
    const snapshot = { entries: { "app.name": "test" }, scopes: {}, revision: "rev-1", timestamp: "2026-01-01" };
    const { fetch, calls } = createMockFetch({
      "GET /v1/config": { status: 200, body: { data: snapshot, meta: { revision: "rev-1" } } },
    });
    const transport = createHttpTransport({ baseUrl: "http://localhost:3399", fetch });
    const result = await transport.resolveAll();
    assert.deepEqual(result, snapshot);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.includes("/v1/config"));
  });

  it("get makes GET /v1/config/{keyPath}", async () => {
    const { fetch } = createMockFetch({
      "GET /v1/config/db/host": { status: 200, body: { data: { key: "db.host", value: "localhost" }, meta: {} } },
    });
    const transport = createHttpTransport({ baseUrl: "http://localhost:3399", fetch });
    const value = await transport.get("db.host");
    assert.equal(value, "localhost");
  });

  it("set makes PUT /v1/config/{keyPath} with value body", async () => {
    const { fetch, calls } = createMockFetch({
      "PUT /v1/config/db/host": { status: 200, body: { data: { success: true, revision: "rev-2" }, meta: {} } },
    });
    const transport = createHttpTransport({ baseUrl: "http://localhost:3399", fetch });
    const result = await transport.set("db.host", "newhost");
    assert.equal(result.success, true);
    const sentBody = JSON.parse(calls[0].init.body);
    assert.deepEqual(sentBody, { value: "newhost" });
  });

  it("set with ifRevision sends If-Match header", async () => {
    const { fetch, calls } = createMockFetch({
      "PUT /v1/config/key": { status: 200, body: { data: { success: true }, meta: {} } },
    });
    const transport = createHttpTransport({ baseUrl: "http://localhost:3399", fetch });
    await transport.set("key", "val", { ifRevision: "rev-1" });
    assert.equal(calls[0].init.headers["If-Match"], '"rev-1"');
  });

  it("remove makes DELETE /v1/config/{keyPath}", async () => {
    const { fetch, calls } = createMockFetch({
      "DELETE /v1/config/old/key": { status: 200, body: { data: { success: true }, meta: {} } },
    });
    const transport = createHttpTransport({ baseUrl: "http://localhost:3399", fetch });
    await transport.remove("old.key");
    assert.equal(calls[0].init.method, "DELETE");
  });

  it("setMany makes PATCH /v1/config", async () => {
    const { fetch, calls } = createMockFetch({
      "PATCH /v1/config": { status: 200, body: { data: { success: true, revision: "rev-3" }, meta: {} } },
    });
    const transport = createHttpTransport({ baseUrl: "http://localhost:3399", fetch });
    const result = await transport.setMany({ a: 1, b: 2 });
    assert.equal(result.success, true);
    const sentBody = JSON.parse(calls[0].init.body);
    assert.deepEqual(sentBody, { entries: { a: 1, b: 2 } });
  });

  it("listScopes makes GET /v1/scopes", async () => {
    const defs = [{ id: "region", label: "Region" }];
    const { fetch } = createMockFetch({
      "GET /v1/scopes": { status: 200, body: { data: { definitions: defs }, meta: {} } },
    });
    const transport = createHttpTransport({ baseUrl: "http://localhost:3399", fetch });
    const result = await transport.listScopes();
    assert.deepEqual(result, defs);
  });

  it("listScopeValues makes GET /v1/scopes/:scopeId", async () => {
    const { fetch } = createMockFetch({
      "GET /v1/scopes/region": { status: 200, body: { data: { values: ["us", "eu"] }, meta: {} } },
    });
    const transport = createHttpTransport({ baseUrl: "http://localhost:3399", fetch });
    const values = await transport.listScopeValues("region");
    assert.deepEqual(values, ["us", "eu"]);
  });

  it("inspect makes GET /v1/config/{keyPath}?inspect", async () => {
    const inspection = { key: "db.host", effectiveValue: "localhost", layerValues: { platform: "localhost" } };
    const { fetch, calls } = createMockFetch({
      "GET /v1/config/db/host": { status: 200, body: { data: inspection, meta: {} } },
    });
    const transport = createHttpTransport({ baseUrl: "http://localhost:3399", fetch });
    const result = await transport.inspect("db.host");
    assert.deepEqual(result, inspection);
    assert.ok(calls[0].url.includes("inspect"));
  });

  it("includes Authorization header when token provided", async () => {
    const { fetch, calls } = createMockFetch({
      "GET /v1/config": { status: 200, body: { data: {}, meta: {} } },
    });
    const transport = createHttpTransport({ baseUrl: "http://localhost:3399", fetch, token: "jwt-123" });
    await transport.resolveAll();
    assert.equal(calls[0].init.headers["Authorization"], "Bearer jwt-123");
  });

  it("close is safe to call", async () => {
    const transport = createHttpTransport({
      baseUrl: "http://localhost:3399",
      fetch: async () => ({ ok: true, status: 200, json: async () => ({}), body: null }),
    });
    await transport.close();
  });

  it("error response returns WriteResult with error", async () => {
    const { fetch } = createMockFetch({
      "PUT /v1/config/key": { status: 400, body: { data: null, error: { code: "VALIDATION_ERROR", message: "bad" } } },
    });
    const transport = createHttpTransport({ baseUrl: "http://localhost:3399", fetch });
    const result = await transport.set("key", "val");
    assert.equal(result.success, false);
    assert.equal(result.error?.code, "VALIDATION_ERROR");
  });
});
