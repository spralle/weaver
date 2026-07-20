# Backend Client Guide

Use `@weaver-conf/weaver-client` in a Node.js backend service for typed, resilient configuration access.

## Installation

```bash
pnpm add @weaver-conf/weaver-client
```

## Create the Client

Connect to weaver-server using the HTTP transport with filesystem persistence for offline resilience:

```typescript
import {
  createWeaverClient,
  createHttpTransport,
  createFileSystemPersistence,
} from "@weaver-conf/weaver-client";

const client = await createWeaverClient({
  transport: createHttpTransport({ baseUrl: "http://weaver-server:3399" }),
  persistence: createFileSystemPersistence({ dir: "./.config-cache" }),
});
```

Filesystem persistence ensures your service can start and serve requests even if weaver-server is temporarily unavailable. The cache directory stores the last known configuration snapshot as JSON.

## Define Service Namespaces

Scope your configuration to your service's domain:

```typescript
import { defineNamespace } from "@weaver-conf/weaver-client";
import { z } from "zod";

const billing = defineNamespace("billing", {
  currency: z.enum(["USD", "EUR", "GBP"]),
  retryMax: z.number().int().min(0).max(10),
  webhookUrl: z.string().url(),
  batchSize: z.number().int().min(1).max(1000),
});

const billingNs = client.namespace(billing);

// Typed reads
const currency = billingNs.get("currency"); // "USD" | "EUR" | "GBP" | undefined
const retryMax = billingNs.get("retryMax"); // number | undefined
```

## Transport Middleware

Add authentication headers, request logging, or other cross-cutting concerns:

```typescript
import { createHttpTransport, withMiddleware } from "@weaver-conf/weaver-client";

const baseTransport = createHttpTransport({ baseUrl: "http://weaver-server:3399" });

const authedTransport = withMiddleware(baseTransport, {
  onBefore: (req) => ({
    ...req,
    headers: {
      ...req.headers,
      Authorization: `Bearer ${getServiceToken()}`,
    },
  }),
  onAfter: (res) => {
    metrics.recordLatency("weaver_config", res.durationMs);
    return res;
  },
});

const client = await createWeaverClient({
  transport: authedTransport,
  persistence: createFileSystemPersistence({ dir: "./.config-cache" }),
});
```

## HTTP Retry and Resilience

The HTTP transport supports automatic retries with exponential backoff:

```typescript
import { createHttpTransport, fetchWithRetry } from "@weaver-conf/weaver-client";

const transport = createHttpTransport({
  baseUrl: "http://weaver-server:3399",
  fetch: fetchWithRetry({
    maxAttempts: 3,
    backoffMs: 500,
    retryOn: [502, 503, 504],
  }),
});
```

This retries failed requests up to 3 times with increasing delays (500ms, 1000ms, 2000ms). Only retries on server errors — client errors (4xx) fail immediately.

## Write Queue for Offline Resilience

If your service needs to write configuration and must handle network interruptions:

```typescript
import { createWriteQueue } from "@weaver-conf/weaver-client";

const writeQueue = createWriteQueue({
  client,
  persistDir: "./.config-writes",
  retryIntervalMs: 5_000,
});

// Writes are queued and retried until acknowledged
await writeQueue.set("billing.lastSyncAt", new Date().toISOString());

// Queue persists to disk — survives process restarts
// Pending writes are replayed on next startup
```

## Subscribe to Changes

React to configuration changes for dynamic behavior:

```typescript
const billingNs = client.namespace(billing);

billingNs.onChange("retryMax", (newMax) => {
  // Update retry logic without restart
  retryPolicy.maxAttempts = newMax;
});

billingNs.onChange("webhookUrl", (url) => {
  // Reconfigure webhook client
  webhookClient.setEndpoint(url);
});
```

Changes arrive via SSE from weaver-server. Your service stays in sync without polling.

## Graceful Shutdown

Close the client when your service shuts down:

```typescript
const server = createServer({ /* ... */ });

process.on("SIGTERM", async () => {
  // Stop accepting new requests
  server.stop();

  // Close weaver client (flushes pending writes, closes SSE)
  await client.close();

  process.exit(0);
});
```

Always call `client.close()` before exit to ensure pending writes are flushed and the SSE connection is cleanly terminated.

## Multi-Service Architecture

Multiple services share a single weaver-server, each owning their own namespace:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  billing-svc    │     │  shipping-svc   │     │  auth-svc       │
│  ns: "billing"  │     │  ns: "shipping" │     │  ns: "auth"     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │     weaver-server       │
                    │  (single config store)  │
                    └─────────────────────────┘
```

Each service:
- Defines its own namespaces with `defineNamespace`
- Reads only its own keys (server enforces access via JWT identity)
- Can subscribe to cross-service keys if authorized (e.g., shared feature flags)

Services don't need to coordinate — the server handles conflict resolution and ordering.

## Testing

Use `createLocalTransport()` for unit tests — no server required:

```typescript
import { createWeaverClient, createLocalTransport } from "@weaver-conf/weaver-client";

const transport = createLocalTransport({
  initialData: {
    "billing.currency": "USD",
    "billing.retryMax": 3,
    "billing.webhookUrl": "https://test.example.com/hook",
    "billing.batchSize": 100,
  },
});

const client = await createWeaverClient({ transport });
const billingNs = client.namespace(billing);

// Test your service logic with controlled config
const currency = billingNs.get("currency"); // "USD"

// Simulate config changes in tests
await billingNs.set("retryMax", 5);
```

`createLocalTransport` stores everything in memory. It supports the full transport interface including change subscriptions, so your `onChange` handlers work in tests too.

### Integration Test Pattern

```typescript
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import { createWeaverClient, createLocalTransport } from "@weaver-conf/weaver-client";

describe("BillingService", () => {
  let client: Awaited<ReturnType<typeof createWeaverClient>>;

  beforeEach(async () => {
    client = await createWeaverClient({
      transport: createLocalTransport({
        initialData: { "billing.currency": "USD", "billing.retryMax": 3 },
      }),
    });
  });

  afterEach(async () => {
    await client.close();
  });

  it("respects retryMax from config", async () => {
    const svc = new BillingService(client);
    // retryMax is 3 from initialData
    expect(svc.getMaxRetries()).toBe(3);
  });

  it("reacts to config changes", async () => {
    const svc = new BillingService(client);
    const billingNs = client.namespace(billing);
    await billingNs.set("retryMax", 7);
    assert.strictEqual(svc.getMaxRetries(), 7);
  });
});
```

## Next Steps

- [Server Quickstart](./server-quickstart.md) — Set up the weaver-server this client connects to
- [Browser Client Guide](./browser-client.md) — Use weaver-client in a browser SPA
