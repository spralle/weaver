# Browser Client Guide

Use `@weaver-conf/weaver-client` in a browser single-page application for typed, real-time configuration with offline support.

## Installation

```bash
pnpm add @weaver-conf/weaver-client
```

## Define Namespaces

Namespaces give you compile-time type safety for configuration keys. Define them using Zod schemas:

```typescript
import { defineNamespace } from "@weaver-conf/weaver-client";
import { z } from "zod";

const theme = defineNamespace("ui.theme", {
  mode: z.enum(["light", "dark"]),
  accent: z.string(),
});

const features = defineNamespace("ui.features", {
  betaEnabled: z.boolean(),
  maxItems: z.number().int().min(1).max(100),
});
```

`defineNamespace` takes a prefix string and a Zod raw shape. The prefix determines which keys in the configuration store belong to this namespace.

## Create the Client

Connect to a running weaver-server using the HTTP transport:

```typescript
import {
  createWeaverClient,
  createHttpTransport,
} from "@weaver-conf/weaver-client";

const client = await createWeaverClient({
  transport: createHttpTransport({ baseUrl: "http://localhost:3399" }),
});
```

`createWeaverClient` is async — it connects to the server and fetches an initial configuration snapshot before returning.

## Read and Write Typed Config

Access a namespace to get a typed accessor:

```typescript
const themeNs = client.namespace(theme);

// Read — fully typed, returns `"light" | "dark" | undefined`
const mode = themeNs.get("mode");

// Write — type-checked value
await themeNs.set("mode", "dark");

// Get all values in the namespace
const allTheme = themeNs.getAll();
// => { mode: "dark", accent: "#3b82f6" }
```

Writes are sent to the server immediately. The returned promise resolves when the server acknowledges the write.

## Subscribe to Changes

React to configuration changes in real-time:

```typescript
// Watch a specific key
const unsubscribe = themeNs.onChange("mode", (newMode) => {
  // newMode: "light" | "dark"
  document.documentElement.dataset.theme = newMode;
});

// Watch any key in the namespace
const unsubAll = themeNs.onAny((key, value) => {
  console.log(`${key} changed to`, value);
});

// Clean up when done
unsubscribe();
unsubAll();
```

Changes arrive via Server-Sent Events (SSE) from weaver-server. The client maintains a persistent connection and applies deltas to local state automatically.

## Offline Persistence

Add IndexedDB persistence so the client works offline and loads instantly on repeat visits:

```typescript
import {
  createWeaverClient,
  createHttpTransport,
  createIndexedDbPersistence,
} from "@weaver-conf/weaver-client";

const client = await createWeaverClient({
  transport: createHttpTransport({ baseUrl: "http://localhost:3399" }),
  persistence: createIndexedDbPersistence({ dbName: "my-app-config" }),
});
```

With persistence enabled:

1. On first load, the client fetches from the server and caches to IndexedDB
2. On subsequent loads, the client returns cached values immediately, then syncs with the server in the background
3. If the server is unreachable, the client serves from cache (degraded mode)

## Staleness Detection

Monitor whether your configuration data is fresh:

```typescript
import { createStalenessMonitor } from "@weaver-conf/weaver-client";

const monitor = createStalenessMonitor({ maxAgeMs: 30_000 });

// Check current staleness
if (monitor.isStale) {
  showBanner("Configuration may be outdated");
}

// React to staleness changes
monitor.onStale(() => {
  showBanner("Lost connection to config server");
});

monitor.onFresh(() => {
  hideBanner();
});
```

The staleness monitor tracks the time since the last successful server sync. If `maxAgeMs` elapses without a sync, the data is considered stale.

## Instance Overrides

For multi-instance widgets (e.g., multiple dashboard panels of the same type), use instance overrides to store per-instance configuration:

```typescript
const panel = defineNamespace("dashboard.panel", {
  title: z.string(),
  refreshInterval: z.number(),
  collapsed: z.boolean(),
});

const panelNs = client.namespace(panel);

// Get an instance-specific accessor
const myPanel = panelNs.instance("panel-abc-123");

// Read/write scoped to this instance
const title = myPanel.get("title");
await myPanel.set("collapsed", true);

// Changes to one instance don't affect others
const otherPanel = panelNs.instance("panel-xyz-789");
otherPanel.get("collapsed"); // independent value
```

Instance overrides are stored on the user layer by default, so each user has their own panel configurations.

## Untyped Escape Hatch

For dynamic keys or cross-namespace reads where you don't have a namespace definition:

```typescript
const untyped = client.untyped();

// Read any key (returns unknown)
const value = untyped.get("some.dynamic.key");

// Write any key
await untyped.set("some.dynamic.key", "hello");

// Subscribe to any key
untyped.onChange("some.dynamic.key", (val) => {
  console.log("changed:", val);
});
```

Use this sparingly — prefer typed namespaces for compile-time safety.

## Framework Integration: React

Use `useSyncExternalStore` for zero-dependency React integration:

```typescript
import { useSyncExternalStore, useCallback } from "react";
import { createWeaverClient, createHttpTransport, defineNamespace } from "@weaver-conf/weaver-client";
import { z } from "zod";

const theme = defineNamespace("ui.theme", {
  mode: z.enum(["light", "dark"]),
  accent: z.string(),
});

// Create client once at module level
const client = await createWeaverClient({
  transport: createHttpTransport({ baseUrl: "/api/config" }),
});
const themeNs = client.namespace(theme);

// Generic hook for any namespace key
function useConfigValue<K extends keyof typeof theme.shape & string>(key: K) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => themeNs.onChange(key, onStoreChange),
    [key],
  );
  const getSnapshot = useCallback(() => themeNs.get(key), [key]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

// Usage in components
function ThemeToggle() {
  const mode = useConfigValue("mode");

  return (
    <button onClick={() => themeNs.set("mode", mode === "dark" ? "light" : "dark")}>
      Current: {mode}
    </button>
  );
}
```

This pattern works with any React version that supports `useSyncExternalStore` (React 18+). The subscription is efficient — React only re-renders when the specific key changes.

## Client Lifecycle

Always clean up the client when your application unmounts:

```typescript
// In a SPA, typically on page unload or app teardown
await client.dispose();
```

This closes the SSE connection, flushes any pending writes, and releases IndexedDB handles.

## Connection Modes

The client operates in one of three modes:

| Mode | Description |
|------|-------------|
| `"live"` | Connected to server, receiving real-time updates |
| `"cached"` | Serving from persistence, server unreachable |
| `"degraded"` | Connected but data may be stale |

```typescript
// Check current mode
console.log(client.mode); // "live" | "cached" | "degraded"

// React to mode changes
client.onMode((mode) => {
  if (mode === "cached") {
    showOfflineBanner();
  }
});
```

## Next Steps

- [Server Quickstart](./server-quickstart.md) — Set up the weaver-server this client connects to
- [Backend Client Guide](./backend-client.md) — Use weaver-client in a Node.js/Bun service
