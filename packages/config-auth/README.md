# @weaver/config-auth

> Role-based access control extension for Weaver configuration via `withAuth()` composition.

## Installation

```bash
bun add @weaver/config-auth
```

## Overview

`@weaver/config-auth` adds authorization checks to the Weaver configuration system. It exports a single `withAuth()` composition function that takes your `WeaverConfig`, role mappings, and write policies, then returns `canRead()`, `canWrite()`, and `filterVisibleKeys()` functions.

All vocabulary — role names, layer names, session modes — is consumer-defined. There are no hardcoded roles or permissions. The auth layer enforces visibility levels (public, admin, platform, internal), layer write policies, per-key write restrictions, `maxOverrideLayer` ceilings, and session mode constraints.

## Usage

### Setting up auth with `withAuth()`

```typescript
import { defineWeaver, Layers } from "@weaver/config-types";
import { withAuth } from "@weaver/config-auth";

const weaver = defineWeaver([
  Layers.Static("core"),
  Layers.Static("tenant"),
  Layers.Personal("user"),
  Layers.Ephemeral("session"),
] as const);

const auth = withAuth({
  weaverConfig: weaver,
  visibilityRoles: {
    admin: new Set(["superadmin", "ops"]),
    platform: new Set(["superadmin", "ops", "platformEngineer"]),
  },
  layerWritePolicies: [
    { layer: "core", allowedRoles: ["superadmin"] },
    { layer: "tenant", allowedRoles: ["superadmin", "tenantAdmin"] },
    { layer: "user", allowedRoles: ["superadmin", "tenantAdmin", "user"] },
  ],
  dynamicScopeRoles: new Set(["superadmin", "tenantAdmin"]),
  sessionLayer: "session",
  elevatedSessionMode: "emergency-override",
});
```

### Checking permissions

```typescript
import type { ConfigurationAccessContext } from "@weaver/config-types";

const caller: ConfigurationAccessContext = {
  roles: ["tenantAdmin"],
  sessionMode: undefined,
};

// Read check — enforces visibility (public/admin/platform/internal)
auth.canRead(caller, "app.ui.theme", propertySchema); // true

// Write check — enforces layer policy + key restrictions + ceiling
auth.canWrite(caller, "tenant", "app.ui.theme", propertySchema); // true
auth.canWrite(caller, "core", "app.ui.theme", propertySchema);   // false

// Filter an entries record to only visible keys
const visible = auth.filterVisibleKeys(caller, allEntries, schemaMap);
```

### maxOverrideLayer ceiling enforcement

If a property schema defines `maxOverrideLayer`, writes to layers ranked above that ceiling are denied — unless the caller has `sessionMode: "emergency-override"`:

```typescript
const schema = { type: "string", maxOverrideLayer: "tenant" };
auth.canWrite(caller, "user", key, schema);   // false — user > tenant
auth.canWrite(emergencyCaller, "user", key, schema); // true — emergency override
```

## API Reference

| Export | Description |
|---|---|
| `withAuth(config)` | Create auth functions from a `WeaverConfig` + role mappings |

### Types

| Type | Description |
|---|---|
| `AuthConfig` | Configuration: weaverConfig, visibilityRoles, layerWritePolicies, dynamicScopeRoles |
| `AuthFunctions` | Returned object: `canRead()`, `canWrite()`, `filterVisibleKeys()` |
| `VisibilityRoleMapping` | Maps `admin` and `platform` visibility to role sets |

## License

MIT
