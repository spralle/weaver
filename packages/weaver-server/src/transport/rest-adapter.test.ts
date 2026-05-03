import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRestAdapter } from "./rest-adapter.js";
import { httpStatusForError } from "../types/index.js";
import type { WeaverConfigService } from "../core/config-service.js";
import type { ScopeManager } from "../core/scope-manager.js";
import type { RestRequest } from "./rest-adapter.js";

function createMockConfigService(): WeaverConfigService {
  let currentRevision = "rev-1";
  const entries: Record<string, unknown> = { "app.name": "test" };

  return {
    get revision() { return currentRevision; },
    providers: [],
    async resolveAll() {
      return { entries: { ...entries }, scopes: {}, revision: currentRevision };
    },
    async get(key: string) { return entries[key]; },
    async getNamespace() { return {}; },
    async inspect(key: string) { return { key, layers: [] }; },
    async set(_layer: string, key: string, value: unknown) {
      entries[key] = value;
      currentRevision = "rev-" + (parseInt(currentRevision.split("-")[1]!) + 1);
      return { success: true as const, revision: currentRevision };
    },
    async remove(_layer: string, key: string) {
      delete entries[key];
      currentRevision = "rev-" + (parseInt(currentRevision.split("-")[1]!) + 1);
      return { success: true as const, revision: currentRevision };
    },
    async reloadProvider() {},
    onDelta() { return () => {}; },
    async flush() {},
    async refreshProviders() {},
  } as unknown as WeaverConfigService;
}

function makeReq(overrides: Partial<RestRequest> = {}): RestRequest {
  return {
    params: {},
    query: {},
    headers: {},
    ...overrides,
  };
}

describe("REST adapter CAS concurrency", () => {
  it("PUT without If-Match succeeds normally", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService() });
    const res = await adapter.handleRequest("PUT", "/v1/config/app.name", makeReq({
      body: { value: "newValue" },
    }));
    assert.equal(res.status, 200);
  });

  it("PUT with matching If-Match succeeds", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService() });
    const res = await adapter.handleRequest("PUT", "/v1/config/app.name", makeReq({
      headers: { "if-match": '"rev-1"' },
      body: { value: "newValue" },
    }));
    assert.equal(res.status, 200);
  });

  it("PUT with non-matching If-Match returns 409 REVISION_CONFLICT", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService() });
    const res = await adapter.handleRequest("PUT", "/v1/config/app.name", makeReq({
      headers: { "if-match": '"rev-wrong"' },
      body: { value: "newValue" },
    }));
    assert.equal(res.status, 409);
    const body = res.body as { error: { code: string; message: string } };
    assert.equal(body.error.code, "REVISION_CONFLICT");
  });

  it("DELETE with matching If-Match succeeds", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService() });
    const res = await adapter.handleRequest("DELETE", "/v1/config/app.name", makeReq({
      headers: { "if-match": '"rev-1"' },
    }));
    assert.equal(res.status, 200);
  });

  it("DELETE with non-matching If-Match returns 409 REVISION_CONFLICT", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService() });
    const res = await adapter.handleRequest("DELETE", "/v1/config/app.name", makeReq({
      headers: { "if-match": '"rev-wrong"' },
    }));
    assert.equal(res.status, 409);
    const body = res.body as { error: { code: string } };
    assert.equal(body.error.code, "REVISION_CONFLICT");
  });

  it("If-None-Match: * on PUT passes through", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService() });
    const res = await adapter.handleRequest("PUT", "/v1/config/app.name", makeReq({
      headers: { "if-none-match": "*" },
      body: { value: "newValue" },
    }));
    assert.equal(res.status, 200);
  });

  it("409 response body includes correct error envelope", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService() });
    const res = await adapter.handleRequest("PUT", "/v1/config/app.name", makeReq({
      headers: { "if-match": '"rev-99"' },
      body: { value: "x" },
    }));
    assert.equal(res.status, 409);
    const body = res.body as { data: null; meta: { revision: string }; error: { code: string; message: string } };
    assert.equal(body.data, null);
    assert.equal(body.error.code, "REVISION_CONFLICT");
    assert.match(body.error.message, /Expected revision rev-99, current is rev-1/);
    assert.equal(body.meta.revision, "rev-1");
  });

  it("ETag header on 409 contains current revision", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService() });
    const res = await adapter.handleRequest("PUT", "/v1/config/app.name", makeReq({
      headers: { "if-match": '"rev-old"' },
      body: { value: "x" },
    }));
    assert.equal(res.headers?.["ETag"], '"rev-1"');
  });

  it("REVISION_CONFLICT maps to HTTP 409 in httpStatusForError", () => {
    assert.equal(httpStatusForError("REVISION_CONFLICT"), 409);
  });
});

function createMockScopeManager(): ScopeManager {
  const scopes = new Map<string, Set<string>>();
  scopes.set("tenant", new Set(["stenaline", "dfds"]));
  scopes.set("site", new Set(["gothenburg", "oslo"]));

  return {
    listScopes() {
      return [...scopes.keys()].map(id => ({ id, label: id }));
    },
    listScopeValues(scopeId: string) {
      return [...(scopes.get(scopeId) ?? [])];
    },
    async provision(req: { scopeId: string; value: string }) {
      const values = scopes.get(req.scopeId) ?? new Set();
      if (values.has(req.value)) {
        return { success: false, scopeId: req.scopeId, value: req.value, error: { code: "VALIDATION_ERROR", message: "Already exists" } };
      }
      values.add(req.value);
      scopes.set(req.scopeId, values);
      return { success: true, scopeId: req.scopeId, value: req.value };
    },
    async deprovision(req: { scopeId: string; value: string }) {
      const values = scopes.get(req.scopeId);
      if (!values?.has(req.value)) {
        return { success: false, scopeId: req.scopeId, value: req.value, error: { code: "SCOPE_NOT_FOUND", message: "Not found" } };
      }
      values.delete(req.value);
      return { success: true, scopeId: req.scopeId, value: req.value };
    },
  } as unknown as ScopeManager;
}

describe("REST adapter scope routes", () => {
  it("GET /v1/scopes returns definitions from ScopeManager", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService(), scopeManager: createMockScopeManager() });
    const res = await adapter.handleRequest("GET", "/v1/scopes", makeReq());
    assert.equal(res.status, 200);
    const body = res.body as { data: { definitions: Array<{ id: string }> } };
    assert.equal(body.data.definitions.length, 2);
    assert.deepEqual(body.data.definitions.map(d => d.id).sort(), ["site", "tenant"]);
  });

  it("GET /v1/scopes returns empty definitions when no ScopeManager", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService() });
    const res = await adapter.handleRequest("GET", "/v1/scopes", makeReq());
    assert.equal(res.status, 200);
    const body = res.body as { data: { definitions: unknown[] } };
    assert.deepEqual(body.data.definitions, []);
  });

  it("GET /v1/scopes/:scopeId returns values for given scope", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService(), scopeManager: createMockScopeManager() });
    const res = await adapter.handleRequest("GET", "/v1/scopes/tenant", makeReq());
    assert.equal(res.status, 200);
    const body = res.body as { data: { values: string[] } };
    assert.deepEqual(body.data.values.sort(), ["dfds", "stenaline"]);
  });

  it("GET /v1/scopes/:scopeId returns empty values when scope has no values", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService(), scopeManager: createMockScopeManager() });
    const res = await adapter.handleRequest("GET", "/v1/scopes/unknown", makeReq());
    assert.equal(res.status, 200);
    const body = res.body as { data: { values: string[] } };
    assert.deepEqual(body.data.values, []);
  });

  it("POST /v1/admin/scopes/:scopeId provisions a scope value", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService(), scopeManager: createMockScopeManager() });
    const res = await adapter.handleRequest("POST", "/v1/admin/scopes/tenant", makeReq({
      body: { value: "viking" },
    }));
    assert.equal(res.status, 201);
    const body = res.body as { data: { success: boolean; scopeId: string; value: string } };
    assert.equal(body.data.success, true);
    assert.equal(body.data.value, "viking");
  });

  it("POST /v1/admin/scopes/:scopeId returns error when value missing", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService(), scopeManager: createMockScopeManager() });
    const res = await adapter.handleRequest("POST", "/v1/admin/scopes/tenant", makeReq({
      body: {},
    }));
    assert.equal(res.status, 400);
    const body = res.body as { error: { code: string } };
    assert.equal(body.error.code, "VALIDATION_ERROR");
  });

  it("DELETE /v1/admin/scopes/:scopeId/:value deprovisions a scope value", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService(), scopeManager: createMockScopeManager() });
    const res = await adapter.handleRequest("DELETE", "/v1/admin/scopes/tenant/stenaline", makeReq());
    assert.equal(res.status, 200);
    const body = res.body as { data: { success: boolean } };
    assert.equal(body.data.success, true);
  });

  it("DELETE /v1/admin/scopes/:scopeId/:value returns error when scope not found", async () => {
    const adapter = createRestAdapter({ configService: createMockConfigService(), scopeManager: createMockScopeManager() });
    const res = await adapter.handleRequest("DELETE", "/v1/admin/scopes/tenant/nonexistent", makeReq());
    assert.equal(res.status, 404);
    const body = res.body as { error: { code: string } };
    assert.equal(body.error.code, "SCOPE_NOT_FOUND");
  });
});
