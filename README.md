# 🧶 Weaver

> Layered configuration for TypeScript — declare your layers, compose providers, resolve with confidence.

## Features

- **Declarative layer stacks** — define your layers with `defineWeaver()`, no hardcoded names
- **Deep merge with provenance tracking** — objects recurse, arrays replace, `null` clears
- **Schema-driven governance** — ceiling enforcement, change policies, visibility controls
- **Multiple storage backends** — in-memory, localStorage, static JSON, file system
- **Override sessions with auto-expiry** — time-limited emergency overrides
- **Role-based access control** — visibility filtering, write restrictions, ceiling enforcement
- **Offline-first sync** — conflict resolution with LWW fallback and queue management
- **Full TypeScript** — zero runtime dependencies in core

## Quick Start

```ts
import { defineWeaver, Layers } from "@weaver/config-types";
import {
  StaticJsonStorageProvider,
  InMemoryStorageProvider,
  createConfigurationService,
} from "@weaver/config-providers";
import { resolveConfiguration, inspectKey } from "@weaver/config-engine";

// 1. Declare your layer stack
const weaver = defineWeaver([
  Layers.Static("defaults"),
  Layers.Dynamic("tenant"),
  Layers.Personal("user"),
] as const);

// 2. Wire up storage providers
const defaults = StaticJsonStorageProvider("defaults", {
  "ui.theme.mode": "light",
  "ui.theme.density": "comfortable",
  "feature.beta.enabled": false,
});
const tenant = InMemoryStorageProvider("tenant");
const user = InMemoryStorageProvider("user");

// 3. Create the configuration service
const service = createConfigurationService(weaver, [defaults, tenant, user]);

// 4. Read resolved values (deep-merged across layers)
const mode = service.get("ui.theme.mode"); // "light"

// 5. Write to a specific layer
service.set("tenant", "feature.beta.enabled", true);

// 6. Inspect where a value comes from
const info = inspectKey(weaver, [defaults, tenant, user], "feature.beta.enabled");
// → { resolved: true, source: "tenant", value: true }
```

## Architecture

Weaver resolves configuration by merging layers bottom-to-top. Each layer has a type that determines its role in the stack:

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

Keys are flat dot-delimited strings with 3–5 segments (e.g. `ui.theme.mode`). Schema metadata on each key controls governance: which layer can override it, what change policies apply, and who can see it.

## Packages

| Package | Description |
| --- | --- |
| [`@weaver/config-types`](./packages/config-types) | Core types, `defineWeaver()` builder, `Layers.*` factories, Zod schemas |
| [`@weaver/config-engine`](./packages/config-engine) | Resolution engine: `resolveConfiguration()`, `inspectKey()`, ceiling resolution, schema registry, deep merge, namespace utilities, JSON Schema & Zod codegen |
| [`@weaver/config-providers`](./packages/config-providers) | Storage providers (`StaticJson`, `InMemory`, `LocalStorage`), `createConfigurationService()`, scoped & view services |
| [`@weaver/config-sessions`](./packages/config-sessions) | `createOverrideSessionProvider()` for time-limited emergency override sessions |
| [`@weaver/config-auth`](./packages/config-auth) | `withAuth()` for role-based access control — visibility filtering, write restrictions, ceiling enforcement |
| [`@weaver/config-policy`](./packages/config-policy) | Change policy evaluation, policy validation, one-way ratchet rules, override tracking |
| [`@weaver/config-server`](./packages/config-server) | Node.js server-side: `FileSystemStorageProvider`, file-based audit log, plugin config with restart detection |
| [`@weaver/config-sync`](./packages/config-sync) | Offline-first sync orchestrator with conflict resolution (LWW fallback, queue management) |

## Key Concepts

### Layer Types

| Type | Purpose | Example |
| --- | --- | --- |
| **Static** | Immutable defaults loaded at startup | Platform defaults, app defaults |
| **Dynamic** | Mutable overrides scoped to a context | Tenant/org configuration |
| **Personal** | User-specific preferences | Theme, locale, layout |
| **Ephemeral** | Temporary overrides with automatic expiry | Emergency sessions, feature flags |

### Resolution & Deep Merge

`resolveConfiguration()` walks the layer stack top-to-bottom and deep-merges values. Objects recurse into nested keys, arrays replace wholesale, and setting a key to `null` clears it (removing the override so lower layers show through).

`inspectKey()` returns the resolved value along with its source layer — useful for debugging and provenance UIs.

### Schema Governance

Each configuration key can declare schema metadata:

- **`maxOverrideLayer`** — ceiling that prevents higher layers from overriding a value (e.g. lock a key at the tenant layer so users can't change it)
- **`changePolicy`** — rules like one-way ratchets that constrain how values evolve over time
- **`visibility`** — controls which roles or contexts can read a key
- **`sessionMode`** — whether a key participates in override sessions

### Override Sessions

`createOverrideSessionProvider()` creates an ephemeral layer for emergency changes. Sessions have a defined duration and automatically expire, reverting to the normal resolution stack. Useful for incident response where you need temporary overrides without permanent configuration changes.

## Development

```bash
bun install
bun run build
bun run test
```

## Origin

Config-related packages extracted from [armada](https://github.com/spralle/armada).

## License

MIT
