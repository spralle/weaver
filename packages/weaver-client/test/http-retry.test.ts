import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchWithRetry } from "../src/http-retry.js";

function createMockFetch(
  responses: Array<{ status: number; body?: unknown } | "network-error">,
) {
  let callCount = 0;
  const fn = async (_url: string, _init?: RequestInit): Promise<Response> => {
    const entry = responses[callCount++];
    if (entry === "network-error") throw new Error("network error");
    return new Response(JSON.stringify(entry.body ?? {}), {
      status: entry.status,
    });
  };
  return {
    fn: fn as typeof globalThis.fetch,
    get callCount() {
      return callCount;
    },
  };
}

const baseOpts = {
  retry: { maxAttempts: 3, baseDelay: 10, maxDelay: 50 },
  timeout: 5000,
};

describe("fetchWithRetry", () => {
  it("returns immediately on 200", async () => {
    const mock = createMockFetch([{ status: 200, body: { ok: true } }]);
    const res = await fetchWithRetry(
      "http://x",
      {},
      { ...baseOpts, fetchFn: mock.fn },
    );
    assert.equal(res.status, 200);
    assert.equal(mock.callCount, 1);
  });

  it("does not retry on 400", async () => {
    const mock = createMockFetch([{ status: 400 }]);
    const res = await fetchWithRetry(
      "http://x",
      {},
      { ...baseOpts, fetchFn: mock.fn },
    );
    assert.equal(res.status, 400);
    assert.equal(mock.callCount, 1);
  });

  it("retries on 503 then succeeds", async () => {
    const mock = createMockFetch([{ status: 503 }, { status: 200 }]);
    const res = await fetchWithRetry(
      "http://x",
      {},
      { ...baseOpts, fetchFn: mock.fn },
    );
    assert.equal(res.status, 200);
    assert.equal(mock.callCount, 2);
  });

  it("retries on network error then succeeds", async () => {
    const mock = createMockFetch(["network-error", { status: 200 }]);
    const res = await fetchWithRetry(
      "http://x",
      {},
      { ...baseOpts, fetchFn: mock.fn },
    );
    assert.equal(res.status, 200);
    assert.equal(mock.callCount, 2);
  });

  it("throws after exhausting retries on network error", async () => {
    const mock = createMockFetch([
      "network-error",
      "network-error",
      "network-error",
    ]);
    await assert.rejects(() =>
      fetchWithRetry("http://x", {}, { ...baseOpts, fetchFn: mock.fn }),
    );
    assert.equal(mock.callCount, 3);
  });

  it("calls onError on each failed attempt", async () => {
    const errors: unknown[] = [];
    const mock = createMockFetch([{ status: 503 }, { status: 200 }]);
    await fetchWithRetry(
      "http://x",
      {},
      { ...baseOpts, fetchFn: mock.fn, onError: (e) => errors.push(e) },
    );
    assert.equal(errors.length, 1);
  });
});
