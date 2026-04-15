# @weaver/config-engine

> Deep merge, layer resolution, key inspection, scope chains, schema registry, and codegen for Weaver configuration.

## Installation

```bash
bun add @weaver/config-engine
```

## Overview

`@weaver/config-engine` is the resolution core of the Weaver configuration system. It takes a stack of configuration layers and produces a single resolved output via deep merge, with full provenance tracking (which layer set each key).

The package also provides namespace utilities for the `{namespace}.{category}.{setting}` key format, a scope chain builder for dynamic tenant hierarchies, a schema registry for aggregating property declarations across modules, and codegen utilities for generating JSON Schema and Zod source from property schemas.

## Usage

### Deep merge

```typescript
import { deepMerge } from "@weaver/config-engine";

const base = { theme: { color: "blue", font: "sans" }, debug: false };
const override = { theme: { color: "red" }, debug: true };

deepMerge(base, override);
// => { theme: { color: "red", font: "sans" }, debug: true }
```

Merge rules: objects deep merge, arrays replace, primitives replace, `null` clears, `undefined` skips.

### Resolving a layer stack

```typescript
import { resolveConfiguration, inspectKey } from "@weaver/config-engine";

const stack = {
  layers: [
    { layer: "core", entries: { "app.ui.theme": "light" } },
    { layer: "tenant", entries: { "app.ui.theme": "dark" } },
    { layer: "user", entries: { "app.ui.fontSize": 14 } },
  ],
};

const resolved = resolveConfiguration(stack);
resolved.entries;    // { "app.ui.theme": "dark", "app.ui.fontSize": 14 }
resolved.provenance; // Map { "app.ui.theme" => "tenant", "app.ui.fontSize" => "user" }

const inspection = inspectKey(stack, "app.ui.theme");
inspection.effectiveValue; // "dark"
inspection.effectiveLayer; // "tenant"
inspection.layerValues;    // { core: "light", tenant: "dark" }
```

### Ceiling enforcement

```typescript
import { resolveConfigurationWithCeiling } from "@weaver/config-engine";

const schemaMap = new Map([
  ["app.security.apiKey", { maxOverrideLayer: "tenant" }],
]);

// Values above the ceiling layer are ignored (unless emergency override)
const resolved = resolveConfigurationWithCeiling(
  stack, schemaMap, false, weaver.getRank,
);
```

### Schema registry

```typescript
import { createSchemaRegistry } from "@weaver/config-engine";

const registry = createSchemaRegistry();
registry.register({
  ownerId: "my-plugin",
  namespace: "app.myPlugin",
  properties: {
    "display.maxItems": { type: "number", defaultValue: 25 },
  },
});

registry.getSchema("app.myPlugin.display.maxItems");
```

### Namespace utilities

```typescript
import { qualifyKey, validateKeyFormat, deriveNamespace } from "@weaver/config-engine";

qualifyKey("app.vesselView", "map.defaultZoom"); // "app.vesselView.map.defaultZoom"
validateKeyFormat("app.vesselView.map.defaultZoom"); // { valid: true }
deriveNamespace("@weaver/vessel-view-plugin"); // "weaver.vesselView"
```

## API Reference

| Export | Description |
|---|---|
| `deepMerge(base, override)` | Deep merge two config objects |
| `resolveConfiguration(stack)` | Resolve a layer stack into merged entries + provenance |
| `inspectKey(stack, key)` | Inspect a key's value across all layers |
| `resolveConfigurationWithCeiling(...)` | Resolve with `maxOverrideLayer` enforcement |
| `buildScopeChain(hierarchy, scopePath)` | Validate and build an ordered scope chain |
| `createSchemaRegistry()` | Create an incremental schema registry |
| `composeConfigurationSchemas(declarations)` | One-shot schema composition |
| `qualifyKey(namespace, relativeKey)` | Join namespace + key with dot separator |
| `validateKeyFormat(key)` | Validate 3-5 segment camelCase key format |
| `deriveNamespace(pluginId)` | Derive namespace from package/plugin ID |
| `extractNamespace(fqKey)` | Extract first two segments as namespace |
| `generateJsonSchema(schemas)` | Generate a JSON Schema document from property schemas |
| `generateZodSchemaSource(schemas)` | Generate Zod schema TypeScript source code |
| `deriveContractFromPackageJson(pkg)` | Extract contract metadata from package.json |

## License

MIT
