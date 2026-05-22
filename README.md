# 🧶 Weaver

> Layered configuration management for TypeScript — nested JSON, typed namespaces, hierarchical scopes.

## Features

- **Typed namespaces** — `defineNamespace()` with Zod schemas for compile-time and runtime safety
- **Nested JSON storage model** — canonical nested objects, resolved via `deepGet`/`deepSet`/`deepMerge`
- **Hierarchical scopes** — region → tenant → user resolution via scope stacks
- **Schema governance** — ceiling enforcement, change policies, one-way ratchets
- **Offline-first sync** — conflict resolution with LWW fallback and queue management
- **Multiple transports** — HTTP/SSE or SCOMP (multiplexed RPC)
- **Layered storage backends** — file system, Git, MongoDB, in-memory, env-overlay
- **Secret management** — provider abstraction with caching (e.g. Azure Key Vault)

## Quick Start

```ts
import { createWeaverClient, createHttpTransport, defineNamespace } from "@weaver-conf/weaver-client";
import { z } from "zod";

// Define a typed namespace
const uiConfig = defineNamespace("ui", {
  theme: z.enum(["light", "dark"]),
  density: z.enum(["comfortable", "compact"]),
  sidebarOpen: z.boolean(),
});

// Create client with HTTP transport
const client = await createWeaverClient({
  transport: createHttpTransport({ baseUrl: "http://localhost:3000/config" }),
});

// Get a typed namespace client
const ui = client.namespace(uiConfig);
const theme = ui.get("theme"); // type: "light" | "dark" | undefined
await ui.set("theme", "dark"); // type-checked!
```

## Architecture

Weaver resolves configuration by merging layers bottom-to-top across hierarchical scopes:

```
  session  ← Ephemeral  (override sessions, auto-expiry)
  user     ← Personal   (user preferences)
  tenant   ← Dynamic    (org-specific overrides)
  app      ← Static     (application defaults)
  core     ← Static     (platform defaults)
  ───────────────────────────────────────────────
  Higher layers override lower ones.
  Deep merge: objects recurse, arrays replace, null clears.
```

Configuration is stored as **nested JSON objects** (not flat dot-paths). The resolution engine uses `deepGet`/`deepSet`/`deepMerge` to compose values across layers and scopes. Clients access config through typed namespaces with Zod validation.

## Packages

| Package | Description |
| --- | --- |
| [`@weaver-conf/config-types`](./packages/config-types) | Core types, `defineWeaver()` builder, `Layers.*` factories, Zod schemas |
| [`@weaver-conf/config-engine`](./packages/config-engine) | Resolution engine: `deepGet`, `deepSet`, `deepMerge`, ceiling enforcement |
| [`@weaver-conf/config-runtime`](./packages/config-runtime) | Pure state container: in-memory state machine, snapshot management |
| [`@weaver-conf/config-sync`](./packages/config-sync) | Offline-first sync orchestrator with conflict resolution (LWW fallback) |
| [`@weaver-conf/config-secrets`](./packages/config-secrets) | SecretProvider, SecretCache, SecretResolutionService |
| [`@weaver-conf/config-policy`](./packages/config-policy) | Change policy evaluation, validation, one-way ratchet rules |
| [`@weaver-conf/config-sessions`](./packages/config-sessions) | Override session provider for time-limited emergency overrides |
| [`@weaver-conf/storage-providers`](./packages/storage-providers) | Storage provider abstractions + implementations (FS, Git, MongoDB, memory, env-overlay) |
| [`@weaver-conf/weaver-client`](./packages/weaver-client) | Unified client SDK: `defineNamespace`, schema validation, offline boot |
| [`@weaver-conf/weaver-server`](./packages/weaver-server) | Server: REST adapter, SSE streaming, SCOMP transport, schema registry |

## Key Concepts

### Layer Types

| Type | Purpose | Example |
| --- | --- | --- |
| **Static** | Immutable defaults loaded at startup | Platform defaults, app defaults |
| **Dynamic** | Mutable overrides scoped to a context | Tenant/org configuration |
| **Personal** | User-specific preferences | Theme, locale, layout |
| **Ephemeral** | Temporary overrides with automatic expiry | Emergency sessions, feature flags |

### Resolution & Deep Merge

The engine walks the layer stack top-to-bottom and deep-merges values. Objects recurse into nested keys, arrays replace wholesale, and `null` clears a key (removing the override so lower layers show through).

### Schema Governance

Each configuration property can declare schema metadata:

- **`maxOverrideLayer`** — ceiling that prevents higher layers from overriding
- **`changePolicy`** — rules like one-way ratchets constraining value evolution
- **`visibility`** — controls which roles or contexts can read a key
- **`sessionMode`** — whether a key participates in override sessions

### Typed Namespaces

`defineNamespace()` creates a typed accessor bound to a Zod shape. The client validates reads and writes at runtime while providing full TypeScript inference for keys and value types.

## Development

```bash
bun install
bun run build
bun run test
```

## License

MIT
