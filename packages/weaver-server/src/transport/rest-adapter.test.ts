import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WeaverConfigService } from "../core/config-service";
import type { ScopeManager } from "../core/scope-manager";
import { createRestAdapter } from "./rest-adapter";

function mockConfigService(): WeaverConfigService {
  return {
    providers: [],
    revision: "test-rev",
    resolveAll: async () => ({
      entries: {},
      scopes: {},
      revision: "test-rev",
      timestamp: new Date().toISOString(),
    }),
    get: async () => undefined,
    getNamespace: async () => ({}),
    inspect: async () => ({
      key: "",
      effectiveValue: undefined,
      layerValues: {},
    }),
    reloadProvider: async () => {},
    set: async () => ({ success: true }),
    remove: async () => ({ success: true }),
    onDelta: () => () => {},
    batch: async <T>(fn: () => Promise<T>) => fn(),
    setMany: async () => ({ success: true, revision: "test-rev" }),
    flush: async () => {},
    refreshProviders: async () => {},
  } as unknown as WeaverConfigService;
}

describe("REST body validation", () => {
  it("PUT /v1/config/key rejects body without value field", async () => {
    const adapter = createRestAdapter({ configService: mockConfigService() });
    const res = await adapter.handleRequest("PUT", "/v1/config/app/name", {
      params: {},
      query: {},
      body: { notValue: 42 },
      headers: {},
    });
    assert.equal(res.status, 400);
    const body = res.body as { error: { code: string } };
    assert.equal(body.error.code, "VALIDATION_ERROR");
  });

  it("PUT /v1/config/key accepts body with value field", async () => {
    const adapter = createRestAdapter({ configService: mockConfigService() });
    const res = await adapter.handleRequest("PUT", "/v1/config/app/name", {
      params: {},
      query: {},
      body: { value: "hello" },
      headers: {},
    });
    assert.equal(res.status, 200);
  });

  it("PATCH /v1/config rejects body without entries", async () => {
    const adapter = createRestAdapter({ configService: mockConfigService() });
    const res = await adapter.handleRequest("PATCH", "/v1/config", {
      params: {},
      query: {},
      body: { notEntries: true },
      headers: {},
    });
    assert.equal(res.status, 400);
  });

  it("PATCH /v1/config accepts body with entries object", async () => {
    const adapter = createRestAdapter({ configService: mockConfigService() });
    const res = await adapter.handleRequest("PATCH", "/v1/config", {
      params: {},
      query: {},
      body: { entries: { key1: "val1" } },
      headers: {},
    });
    assert.equal(res.status, 200);
  });

  it("POST /v1/admin/scopes/:scopeId rejects body without value", async () => {
    const sm: ScopeManager = {
      listScopes: () => [],
      listScopeValues: () => [],
      provision: async (request) => ({
        success: true,
        scopeId: request.scopeId,
        value: request.value,
      }),
      deprovision: async (request) => ({
        success: true,
        scopeId: request.scopeId,
        value: request.value,
      }),
    };
    const adapter = createRestAdapter({
      configService: mockConfigService(),
      scopeManager: sm,
    });
    const res = await adapter.handleRequest("POST", "/v1/admin/scopes/region", {
      params: {},
      query: {},
      body: { notValue: true },
      headers: {},
    });
    assert.equal(res.status, 400);
  });

  it("POST /v1/admin/scopes/:scopeId accepts valid body", async () => {
    const sm: ScopeManager = {
      listScopes: () => [],
      listScopeValues: () => [],
      provision: async (request) => ({
        success: true,
        scopeId: request.scopeId,
        value: request.value,
      }),
      deprovision: async (request) => ({
        success: true,
        scopeId: request.scopeId,
        value: request.value,
      }),
    };
    const adapter = createRestAdapter({
      configService: mockConfigService(),
      scopeManager: sm,
    });
    const res = await adapter.handleRequest("POST", "/v1/admin/scopes/region", {
      params: {},
      query: {},
      body: { value: "us-east-1" },
      headers: {},
    });
    assert.equal(res.status, 201);
  });
});
