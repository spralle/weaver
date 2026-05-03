// Webhook handler — verifies GitHub webhook signatures and triggers change detection
import { createHmac, timingSafeEqual } from "node:crypto";
import type { ChangeDetector } from "./change-detector.js";

export interface WebhookHandlerOptions {
  changeDetector: ChangeDetector;
  secret?: string;
}

export interface WebhookHandler {
  handleRequest(body: string, signature?: string): Promise<boolean>;
}

function verifySignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * @alpha Not yet wired into startWeaverServer — planned for GitHub webhook integration.
 */
export function createWebhookHandler(
  options: WebhookHandlerOptions,
): WebhookHandler {
  const { changeDetector, secret } = options;

  return {
    async handleRequest(body: string, signature?: string): Promise<boolean> {
      if (secret) {
        if (!signature) return false;
        if (!verifySignature(body, signature, secret)) return false;
      }

      await changeDetector.triggerCheck();
      return true;
    },
  };
}
