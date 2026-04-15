# @weaver/config-server

> Server-side storage provider, service configuration factory, and audit logging for Weaver.

## Installation

```bash
bun add @weaver/config-server
```

## Overview

`@weaver/config-server` provides Node.js-specific components for running Weaver on the server. It includes a file system storage provider that reads/writes JSON configuration files (with optional environment overlays), a namespace-scoped service configuration factory with restart tracking, and an audit log interface with file system and in-memory implementations.

The `FileSystemStorageProvider` performs atomic writes (write-to-temp + rename) for crash safety and supports environment-specific overlays that are deep-merged on top of the base configuration file. The `createServiceConfigurationService()` factory wraps a `ConfigurationService` with namespace scoping and automatic restart-required detection.

## Usage

### File system provider

```typescript
import { FileSystemStorageProvider } from "@weaver/config-server";

const provider = new FileSystemStorageProvider({
  id: "core-config",
  layer: "core",
  filePath: "./config/core.json",
  writable: false,
  environmentOverlayPath: "./config/core.production.json",
});

const data = await provider.load();
// Base config deep-merged with environment overlay
```

### Service configuration with restart tracking

```typescript
import { createServiceConfigurationService } from "@weaver/config-server";
import type { ConfigurationPropertySchema } from "@weaver/config-types";

const schemas = new Map<string, ConfigurationPropertySchema>([
  ["db.connectionPool", { type: "number", reloadBehavior: "restart-required" }],
  ["ui.brandColor", { type: "string", reloadBehavior: "hot-reload" }],
]);

const svcConfig = createServiceConfigurationService({
  configService: globalConfigService,
  namespace: "myApp.backend",
  schemaMap: schemas,
});

svcConfig.get("db.connectionPool"); // reads "myApp.backend.db.connectionPool"
svcConfig.pendingRestart;           // true if a restart-required key changed

svcConfig.onRestartRequired(() => {
  console.warn("Service restart needed to apply config changes");
});
```

### Audit logging

```typescript
import {
  createFileSystemAuditLog,
  createInMemoryAuditLog,
} from "@weaver/config-server";

const auditLog = createFileSystemAuditLog({ dirPath: "./audit-logs" });
// or for testing:
const auditLog = createInMemoryAuditLog();

await auditLog.append({
  key: "app.security.maxLoginAttempts",
  previousValue: 5,
  newValue: 3,
  changedBy: "admin@example.com",
  changedAt: new Date().toISOString(),
  layer: "tenant",
});

const history = await auditLog.queryByKey("app.security.maxLoginAttempts");
const recent = await auditLog.getRecent(10);
```

## API Reference

| Export | Description |
|---|---|
| `FileSystemStorageProvider` | JSON file-backed provider with atomic writes and environment overlays |
| `createServiceConfigurationService(options)` | Namespace-scoped service config with restart tracking |
| `createFileSystemAuditLog(options)` | File system audit log implementation |
| `createInMemoryAuditLog()` | In-memory audit log (testing) |

### Types

| Type | Description |
|---|---|
| `FileSystemProviderOptions` | Options: id, layer, filePath, writable, environmentOverlayPath |
| `ServiceConfigurationOptions` | Options: configService, namespace, schemaMap |
| `ConfigAuditLog` | Audit log interface: append, queryByKey, queryByTimeRange, getRecent |

## License

MIT
