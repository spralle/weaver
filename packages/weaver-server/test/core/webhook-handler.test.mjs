import { test, describe } from "bun:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createWebhookHandler } from "../../src/core/webhook-handler.ts";

function createMockDetector() {
  let checkCount = 0;
  return {
    get checkCount() { return checkCount; },
    start() {},
    stop() {},
    async triggerCheck() { checkCount++; },
  };
}

describe("WebhookHandler", () => {
  test("valid HMAC signature passes verification", async () => {
    const secret = "test-secret";
    const detector = createMockDetector();
    const handler = createWebhookHandler({ changeDetector: detector, secret });

    const body = JSON.stringify({ ref: "refs/heads/main" });
    const sig = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

    const result = await handler.handleRequest(body, sig);
    assert.equal(result, true);
    assert.equal(detector.checkCount, 1);
  });

  test("invalid signature is rejected", async () => {
    const detector = createMockDetector();
    const handler = createWebhookHandler({
      changeDetector: detector,
      secret: "real-secret",
    });

    const body = "{}";
    const result = await handler.handleRequest(body, "sha256=invalid");
    assert.equal(result, false);
    assert.equal(detector.checkCount, 0);
  });

  test("missing signature is rejected when secret configured", async () => {
    const detector = createMockDetector();
    const handler = createWebhookHandler({
      changeDetector: detector,
      secret: "my-secret",
    });

    const result = await handler.handleRequest("{}");
    assert.equal(result, false);
  });

  test("no-secret mode accepts all requests", async () => {
    const detector = createMockDetector();
    const handler = createWebhookHandler({ changeDetector: detector });

    const result = await handler.handleRequest("{}");
    assert.equal(result, true);
    assert.equal(detector.checkCount, 1);
  });
});
