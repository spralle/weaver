# Service Integration Guide

> How to integrate your service with Weaver — from zero to production-ready configuration.

## Overview

Integrating with Weaver involves these steps:

1. **Derive your config contract** — establish your namespace from your package identity
2. **Declare your config schemas** — register the keys your service owns
3. **Set up auth** — configure roles, visibility, and write policies
4. **Wire providers** — connect storage backends to layers
5. **Create your configuration service** — the runtime entry point for reading/writing
6. **Add policy governance** — enforce change policies on sensitive keys
7. **Optional: Override sessions** — enable emergency overrides with auto-expiry

---

## Prerequisites

```bash
bun add @weaver/config-types @weaver/config-engine @weaver/config-providers
# Optional, based on needs:
bun add @weaver/config-auth      # Role-based access control
bun add @weaver/config-policy    # Change policy enforcement
bun add @weaver/config-sessions  # Emergency override sessions
```

---

## Step 1: Derive Your Config Contract

Every service has a **namespace** — a two-segment prefix that scopes all its keys. Weaver derives this from your `package.json`:

```typescript
import { deriveContractFromPackageJson } from "@weaver/config-engine";

const contract = deriveContractFromPackageJson({
  name: "@acme/billing-service",
  version: "2.1.0",
  description: "Handles payment processing and invoicing",
});

// Result:
// {
//   pluginId: "@acme/billing-service",
//   namespace: "acme.billingService",
//   version: "2.1.0",
//   description: "Handles payment processing and invoicing",
// }
```

### Namespace Rules

- Scoped packages: `@acme/billing-service` → `acme.billingService`
- Unscoped packages: `my-config-plugin` → `my.configPlugin`
- Hyphens convert to camelCase, scope becomes first segment
- Override with `weaver.configNamespace` in your `package.json`:

```json
{
  "name": "@acme/billing-service",
  "weaver": { "configNamespace": "billing" }
}
```

### Key Format

All config keys are dot-delimited with 3–5 segments:

```
<namespace>.<category>[.<subcategory>]
  └─ 2 segments ─┘  └── 1-3 segments ──┘

Examples:
  acme.billingService.currency
  acme.billingService.retry.maxAttempts
  acme.billingService.payment.stripe.apiVersion
```

---

## Step 2: Declare Your Config Schemas

Register the configuration keys your service owns. Each key has a **schema** that defines its type, constraints, and governance metadata.

```typescript
import { createSchemaRegistry } from "@weaver/config-engine";
import type { ConfigurationPropertySchema } from "@weaver/config-types";

const registry = createSchemaRegistry();

// Register your service's configuration schema
const result = registry.register({
  ownerId: contract.pluginId,       // "@acme/billing-service"
  namespace: contract.namespace,     // "acme.billingService"
  properties: {
    // Keys are RELATIVE — namespace is prepended automatically
    // This becomes "acme.billingService.currency"
    "currency": {
      type: "string",
      default: "USD",
      enum: ["USD", "EUR", "GBP", "JPY"],
      description: "Default billing currency for new accounts",
      changePolicy: "staging-gate",
      visibility: "admin",
    },

    "retry.maxAttempts": {
      type: "integer",
      default: 3,
      minimum: 0,
      maximum: 10,
      description: "Max payment retry attempts before marking failed",
      changePolicy: "direct-allowed",
    },

    "stripe.apiVersion": {
      type: "string",
      default: "2024-06-20",
      description: "Stripe API version pinned for this service",
      changePolicy: "full-pipeline",
      visibility: "platform",
      reloadBehavior: "restart-required",
    },

    "webhook.secret": {
      type: "string",
      description: "Stripe webhook signing secret",
      sensitive: true,
      visibility: "internal",
      changePolicy: "full-pipeline",
      writeRestriction: ["platform-eng"],
    },
  },
});

// Check for registration errors
if (result.errors.length > 0) {
  console.error("Schema registration errors:", result.errors);
}

console.log("Registered keys:", result.registeredKeys);
// ["acme.billingService.currency", "acme.billingService.retry.maxAttempts", ...]
```

### Schema Governance Fields

| Field | Purpose | Values |
|-------|---------|--------|
| `changePolicy` | How changes flow to production | `"direct-allowed"` (default), `"staging-gate"`, `"full-pipeline"`, `"emergency-override"` |
| `visibility` | Who can read this key | `"public"` (default), `"admin"`, `"platform"`, `"internal"` |
| `sensitive` | Marks value for redaction in logs/UIs | `true` / `false` |
| `maxOverrideLayer` | Ceiling — prevents higher layers from overriding | Any layer name (e.g., `"tenant"`) |
| `writeRestriction` | Roles that can write this key | Array of role strings |
| `reloadBehavior` | What happens when this key changes | `"hot"`, `"restart-required"`, `"rolling-restart"` |
| `sessionMode` | Override session participation | `"allowed"` (default), `"restricted"`, `"blocked"` |

---

## Step 3: Set Up Auth

Auth controls who can read and write configuration values. You configure it once at application startup.

```typescript
import { withAuth } from "@weaver/config-auth";

const auth = withAuth({
  // The layer stack definition (from Step 4)
  weaverConfig,

  // Which roles can see admin/platform-visibility keys
  visibilityRoles: {
    admin: new Set(["admin", "tenant-admin", "billing-admin"]),
    platform: new Set(["platform-eng", "sre"]),
  },

  // Which roles can write to each layer
  layerWritePolicies: [
    { layer: "defaults", allowedRoles: ["platform-eng"] },
    { layer: "tenant", allowedRoles: ["admin", "tenant-admin"] },
    { layer: "user", allowedRoles: ["user", "admin"] },
    { layer: "session", allowedRoles: ["admin", "sre"] },
  ],

  // Roles that can write to dynamic-scoped layers
  dynamicScopeRoles: new Set(["admin", "scope-admin"]),

  // Session layer name (must match your layer definition)
  sessionLayer: "session",

  // Session mode that bypasses restrictions (god-mode)
  elevatedSessionMode: "god-mode",
});
```

### Auth Functions

```typescript
// Check if a user can read a key
const canRead = auth.canRead(accessContext, "acme.billingService.webhook.secret", schema);
// → false (visibility: "internal" denies all readers)

// Check if a user can write to a layer
const canWrite = auth.canWrite(accessContext, "tenant", "acme.billingService.currency", schema);
// → true/false based on roles + writeRestriction + maxOverrideLayer

// Filter a config snapshot to only visible keys
const visible = auth.filterVisibleKeys(accessContext, allEntries, schemaMap);
```

### Access Context

Every auth check requires a `ConfigurationAccessContext` describing the caller:

```typescript
const accessContext = {
  userId: "user-123",
  tenantId: "tenant-456",
  roles: ["admin", "billing-admin"] as const,
  // Optional: for scope-based access
  assignedScopes: [{ scopeId: "region", instanceId: "eu-west" }],
  // Optional: for override sessions
  sessionMode: "emergency-override",
};
```

---

## Step 4: Define Your Layer Stack

Layers are the foundation of Weaver's resolution model. Higher layers override lower ones.

```typescript
import { defineWeaver, Layers } from "@weaver/config-types";

const weaverConfig = defineWeaver([
  // Bottom (lowest priority) → Top (highest priority)
  Layers.Static("defaults"),                    // Immutable application defaults
  Layers.Dynamic("tenant", {                    // Org-specific overrides
    scopes: [
      { id: "region", label: "Region" },
      { id: "team", label: "Team", parent: "region" },
    ],
  }),
  Layers.Personal("user"),                      // User preferences
  Layers.Ephemeral("session"),                  // Emergency overrides (auto-expire)
] as const);
```

### Layer Types

| Type | Purpose | Writable | Persistent |
|------|---------|----------|------------|
| `Static` | Immutable defaults loaded at startup | No | Yes |
| `Dynamic` | Mutable overrides scoped to a context (tenant, region) | Yes | Yes |
| `Personal` | User-specific preferences | Yes | Yes |
| `Ephemeral` | Temporary overrides with auto-expiry | Yes | No |

### Wire Storage Providers

Each layer needs a storage provider:

```typescript
import {
  StaticJsonStorageProvider,
  InMemoryStorageProvider,
} from "@weaver/config-providers";

// Read-only: application defaults
const defaultsProvider = new StaticJsonStorageProvider({
  id: "defaults-store",
  layer: "defaults",
  data: {
    "acme.billingService.currency": "USD",
    "acme.billingService.retry.maxAttempts": 3,
    "acme.billingService.stripe.apiVersion": "2024-06-20",
  },
});

// Writable: tenant-level overrides (use your own DB-backed provider in production)
const tenantProvider = new InMemoryStorageProvider({
  id: "tenant-store",
  layer: "tenant",
  initialEntries: {},
});

// Writable: user preferences
const userProvider = new InMemoryStorageProvider({
  id: "user-store",
  layer: "user",
});
```

### Custom Storage Provider

For production, implement `ConfigurationStorageProvider`:

```typescript
interface ConfigurationStorageProvider {
  readonly id: string;
  readonly layer: string;
  readonly writable: boolean;
  load(): Promise<ConfigurationLayerData>;
  write(key: string, value: unknown): Promise<WriteResult>;
  remove(key: string): Promise<WriteResult>;
}

interface ConfigurationLayerData {
  entries: Record<string, unknown>;
  revision?: string;
}

type WriteResult =
  | { success: true; revision?: string }
  | { success: false; reason: string };
```

---

## Step 5: Create the Configuration Service

Bring it all together:

```typescript
import {
  createConfigurationService,
  createScopedConfigurationService,
} from "@weaver/config-providers";

// Create the root service
const configService = await createConfigurationService({
  providers: [defaultsProvider, tenantProvider, userProvider],
  weaverConfig,
  // Optional: pass session controller (see Step 7)
  session: sessionController,
});

// Read resolved values (deep-merged across all layers)
const currency = configService.get<string>("acme.billingService.currency");
// → "USD" (from defaults, unless tenant/user overrides it)

// Read with fallback
const retries = configService.getWithDefault("acme.billingService.retry.maxAttempts", 3);

// Write to a specific layer
configService.set("acme.billingService.currency", "EUR", "tenant");

// Inspect provenance (debugging)
const inspection = configService.inspect("acme.billingService.currency");
// → { effectiveValue: "EUR", effectiveLayer: "tenant", layers: [...] }

// Listen for changes
const unsubscribe = configService.onChange("acme.billingService.currency", (newValue) => {
  console.log("Currency changed to:", newValue);
});
```

### Scoped Service (Recommended for Plugins)

Instead of using fully-qualified keys everywhere, create a scoped service:

```typescript
const billingConfig = createScopedConfigurationService(configService, "acme.billingService");

// Now use relative keys
const currency = billingConfig.get<string>("currency");           // reads "acme.billingService.currency"
const retries = billingConfig.getWithDefault("retry.maxAttempts", 3);

// Scope-aware reads (multi-tenant)
const regionalCurrency = billingConfig.getForScope("currency", [
  { scopeId: "region", instanceId: "eu-west" },
]);
```

---

## Step 6: Add Policy Governance

For keys with change policies stricter than `"direct-allowed"`, check the policy before writing:

```typescript
import { evaluateChangePolicy } from "@weaver/config-policy";

const key = "acme.billingService.currency";
const schema = registry.getSchema(key)?.schema;

if (schema) {
  const decision = evaluateChangePolicy(
    schema,
    {
      ...accessContext,
      overrideReason: "Customer requested EUR billing",  // Required for emergency-override
    },
    "tenant",       // target layer
    auth.canWrite,  // auth check function
  );

  switch (decision.outcome) {
    case "allowed":
      configService.set(key, "EUR", "tenant");
      break;
    case "requires-promotion":
      // Route to staging/approval workflow
      console.log("Needs promotion:", decision.message);
      break;
    case "requires-emergency-auth":
      // Need elevated session + reason
      console.log("Needs emergency auth:", decision.message);
      break;
    case "denied":
      console.error("Denied:", decision.reason);
      break;
  }
}
```

### Change Policy Ladder

| Policy | Behavior | Use Case |
|--------|----------|----------|
| `direct-allowed` | Write immediately | Non-sensitive, low-risk keys |
| `staging-gate` | Requires promotion workflow | Business-critical values |
| `full-pipeline` | Requires full CI/CD pipeline | Infrastructure, security keys |
| `emergency-override` | Only with active emergency session + reason | Break-glass scenarios |

---

## Step 7: Override Sessions (Optional)

For incident response, enable time-limited emergency overrides:

```typescript
import { createOverrideSessionProvider } from "@weaver/config-sessions";

const sessionController = createOverrideSessionProvider({
  layer: "session",
  defaultDurationMs: 4 * 60 * 60 * 1000, // 4 hours
  onAudit: (entry) => {
    // Send to your audit log
    auditService.log(entry);
  },
});

// Pass sessionController to createConfigurationService (see Step 5)
```

### Session Lifecycle

```typescript
// 1. Activate (requires reason)
const session = sessionController.activate({
  reason: "Payment gateway timeout — disabling retries",
  activatedBy: "oncall@acme.com",
  durationMs: 2 * 60 * 60 * 1000,  // 2 hours (optional override)
  elevatedAuth: {                    // Optional: for restricted keys
    token: "emergency-token-xyz",
    method: "yubikey",
  },
});

// 2. Write overrides (these live in the ephemeral "session" layer)
configService.set("acme.billingService.retry.maxAttempts", 0, "session");

// 3. Extend if needed
sessionController.extend(1 * 60 * 60 * 1000); // +1 hour

// 4. Deactivate (or let it auto-expire)
const result = sessionController.deactivate();
// → { sessionId: "...", overridesCleared: 1, auditRecorded: true }
```

### Session Modes on Keys

Control which keys participate in override sessions:

| `sessionMode` | Behavior |
|---------------|----------|
| `"allowed"` (default) | Can be overridden in any session |
| `"restricted"` | Only overridable with elevated session mode (god-mode) |
| `"blocked"` | Cannot be overridden via sessions at all |

---

## Complete Example

```typescript
import { defineWeaver, Layers } from "@weaver/config-types";
import {
  createSchemaRegistry,
  deriveContractFromPackageJson,
} from "@weaver/config-engine";
import {
  createConfigurationService,
  createScopedConfigurationService,
  StaticJsonStorageProvider,
  InMemoryStorageProvider,
} from "@weaver/config-providers";
import { withAuth } from "@weaver/config-auth";
import { evaluateChangePolicy } from "@weaver/config-policy";
import { createOverrideSessionProvider } from "@weaver/config-sessions";

// ─── Layer Stack ────────────────────────────────────────────
const weaverConfig = defineWeaver([
  Layers.Static("defaults"),
  Layers.Dynamic("tenant"),
  Layers.Personal("user"),
  Layers.Ephemeral("session"),
] as const);

// ─── Contract & Schema ──────────────────────────────────────
const contract = deriveContractFromPackageJson({
  name: "@acme/billing-service",
  version: "2.1.0",
});

const registry = createSchemaRegistry();
registry.register({
  ownerId: contract.pluginId,
  namespace: contract.namespace,
  properties: {
    "currency": {
      type: "string",
      default: "USD",
      enum: ["USD", "EUR", "GBP"],
      changePolicy: "staging-gate",
      visibility: "admin",
    },
    "retry.maxAttempts": {
      type: "integer",
      default: 3,
      minimum: 0,
      maximum: 10,
    },
  },
});

// ─── Auth ───────────────────────────────────────────────────
const auth = withAuth({
  weaverConfig,
  visibilityRoles: {
    admin: new Set(["admin"]),
    platform: new Set(["platform-eng"]),
  },
  layerWritePolicies: [
    { layer: "defaults", allowedRoles: ["platform-eng"] },
    { layer: "tenant", allowedRoles: ["admin"] },
    { layer: "user", allowedRoles: ["user", "admin"] },
    { layer: "session", allowedRoles: ["admin"] },
  ],
  dynamicScopeRoles: new Set(["admin"]),
  sessionLayer: "session",
});

// ─── Providers ──────────────────────────────────────────────
const defaults = new StaticJsonStorageProvider({
  id: "defaults",
  layer: "defaults",
  data: {
    "acme.billingService.currency": "USD",
    "acme.billingService.retry.maxAttempts": 3,
  },
});
const tenant = new InMemoryStorageProvider({ id: "tenant", layer: "tenant" });
const user = new InMemoryStorageProvider({ id: "user", layer: "user" });

// ─── Session ────────────────────────────────────────────────
const sessionCtrl = createOverrideSessionProvider({
  layer: "session",
  onAudit: (entry) => console.log("[audit]", entry),
});

// ─── Service ────────────────────────────────────────────────
const service = await createConfigurationService({
  providers: [defaults, tenant, user],
  weaverConfig,
  session: sessionCtrl,
});

// ─── Usage ──────────────────────────────────────────────────
const billing = createScopedConfigurationService(service, contract.namespace);

// Read
console.log(billing.get("currency"));            // "USD"
console.log(billing.get("retry.maxAttempts"));   // 3

// Write (with policy check)
const schema = registry.getSchema("acme.billingService.currency")!.schema;
const ctx = { userId: "u1", tenantId: "t1", roles: ["admin"] as const };
const decision = evaluateChangePolicy(schema, ctx, "tenant", auth.canWrite);

if (decision.outcome === "allowed") {
  service.set("acme.billingService.currency", "EUR", "tenant");
}
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Service                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ScopedConfigurationService (relative keys)                     │
│        ↓                                                         │
│   ConfigurationService (fully-qualified keys)                    │
│        ↓                                                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│   │ session  │  │   user   │  │  tenant  │  │   defaults    │  │
│   │ Ephemeral│  │ Personal │  │ Dynamic  │  │    Static     │  │
│   │ (hi pri) │  │          │  │          │  │  (lo pri)     │  │
│   └──────────┘  └──────────┘  └──────────┘  └───────────────┘  │
│        ↑              ↑             ↑              ↑             │
│   SessionCtrl    InMemory      InMemory      StaticJson         │
│                                                                  │
├──────────────────────┬──────────────────────────────────────────┤
│   Auth (withAuth)    │   Policy (evaluateChangePolicy)          │
│   - canRead          │   - direct-allowed                       │
│   - canWrite         │   - staging-gate                         │
│   - filterVisible    │   - full-pipeline                        │
│                      │   - emergency-override                   │
├──────────────────────┴──────────────────────────────────────────┤
│   Schema Registry (createSchemaRegistry)                        │
│   - register() / unregister()                                   │
│   - getSchema() / getSchemasByOwner()                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

- **Server-side?** See `@weaver/config-server` for `FileSystemStorageProvider` and audit logging
- **Offline sync?** See `@weaver/config-sync` for conflict resolution and queue management
- **JSON Schema export?** Use `generateJsonSchema()` from `@weaver/config-engine` to export your schemas for external tooling
- **Zod schema codegen?** Use `generateZodSchemaSource()` to generate runtime validators from your property schemas
