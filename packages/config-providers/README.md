# @weaver/config-providers

> Storage provider implementations and the configuration service factory for Weaver.

## Installation

```bash
bun add @weaver/config-providers
```

## Overview

`@weaver/config-providers` provides the concrete storage backends and service factories that bring a Weaver layer stack to life at runtime. It includes three built-in storage providers (InMemory, StaticJson, LocalStorage), a reactive state container that handles deep merge resolution and change notifications, and factory functions for creating `ConfigurationService`, `ScopedConfigurationService`, and `ViewConfigurationService` instances.

Providers implement the `ConfigurationStorageProvider` interface from `@weaver/config-types`. Each provider is bound to a specific layer and can be read-only or writable. The `createConfigurationService()` factory wires providers together with the resolution engine, automatically sorting by layer rank from your `WeaverConfig`.

## Usage

### Setting up providers and creating a service

```typescript
import { defineWeaver, Layers } from "@weaver/config-types";
import {
  StaticJsonStorageProvider,
  InMemoryStorageProvider,
  LocalStorageProvider,
  createConfigurationService,
} from "@weaver/config-providers";

const weaver = defineWeaver([
  Layers.Static("core"),
  Layers.Static("tenant"),
  Layers.Personal("user"),
] as const);

const coreProvider = new StaticJsonStorageProvider({
  id: "core",
  layer: "core",
  data: { "app.ui.theme": "light", "app.ui.fontSize": 14 },
});

const tenantProvider = new InMemoryStorageProvider({
  id: "tenant",
  layer: "tenant",
  initialEntries: { "app.ui.theme": "dark" },
});

const userProvider = new LocalStorageProvider({
  id: "user-prefs",
  layer: "user",
  storageKey: "weaver-user-config",
});

const service = await createConfigurationService({
  providers: [coreProvider, tenantProvider, userProvider],
  weaverConfig: weaver,
});

service.get("app.ui.theme");    // "dark" (tenant overrides core)
service.get("app.ui.fontSize"); // 14 (inherited from core)
```

### Reactive change notifications

```typescript
const unsubscribe = service.onChange("app.ui.theme", (newValue) => {
  console.log("Theme changed to", newValue);
});

service.set("app.ui.theme", "ocean", "user");
// logs: Theme changed to ocean
```

### Inspecting key provenance

```typescript
const info = service.inspect("app.ui.theme");
// { key, effectiveValue: "dark", effectiveLayer: "tenant", layerValues: { core: "light", tenant: "dark" } }
```

### Scoped resolution

```typescript
import { createScopedConfigurationService } from "@weaver/config-providers";

const scopedService = createScopedConfigurationService(/* ... */);
```

## API Reference

| Export | Description |
|---|---|
| `StaticJsonStorageProvider` | Read-only provider backed by a static JSON object |
| `InMemoryStorageProvider` | Writable in-memory provider (test doubles, ephemeral layers) |
| `LocalStorageProvider` | Writable provider backed by browser `localStorage` |
| `createConfigurationService(options)` | Factory: wires providers + WeaverConfig into a `ConfigurationService` |
| `createScopedConfigurationService(...)` | Factory for scope-aware configuration resolution |
| `createViewConfigurationService(...)` | Factory for view-level configuration |
| `createStateContainer(getRank)` | Internal reactive state container with change tracking |
| `MemoryDurableConfigCacheAdapter` | In-memory adapter for `DurableConfigCache` (sync support) |

## License

MIT
