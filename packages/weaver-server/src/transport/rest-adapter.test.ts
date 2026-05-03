import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRestAdapter } from "./rest-adapter.js";
import { httpStatusForError } from "../types/index.js";
import type { WeaverConfigService } from "../core/config-service.js";
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
