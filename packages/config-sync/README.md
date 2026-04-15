# @weaver/config-sync

> Offline-first sync orchestrator with snapshot caching, mutation queuing, and conflict resolution for Weaver.

## Installation

```bash
bun add @weaver/config-sync
```

## Overview

`@weaver/config-sync` provides the synchronization layer for Weaver configuration. It implements an offline-first architecture: local writes are immediately applied to a snapshot cache and queued as mutations, then flushed to the server when connectivity is available. Pull cycles bring server-side changes into the local snapshot.

The sync orchestrator handles retry with exponential backoff, batch pushing, conflict detection, and online/offline transitions. The `SyncableStorageProviderAdapter` wraps the orchestrator into a `ConfigurationStorageProvider`-compatible interface that can be plugged directly into `createConfigurationService()`.

## Usage

### Creating a syncable provider

```typescript
import {
  SyncableStorageProviderAdapter,
  createConfigSyncOrchestrator,
} from "@weaver/config-sync";
import { MemoryDurableConfigCacheAdapter } from "@weaver/config-providers";

const syncProvider = new SyncableStorageProviderAdapter({
  id: "tenant-sync",
  layer: "tenant",
  snapshotCache: new MemoryDurableConfigCacheAdapter(),
  mutationQueue: myMutationQueueImpl,
  transport: myTransportImpl,
  retryPolicy: { baseDelayMs: 500, maxDelayMs: 30_000 },
  conflictResolution: "server-authoritative",
});

// Use as a regular provider in the configuration service
const service = await createConfigurationService({
  providers: [coreProvider, syncProvider],
  weaverConfig: weaver,
});
```

### Monitoring sync state

```typescript
const unsubscribe = syncProvider.onSyncStateChange((state) => {
  // state.status: "synced" | "syncing" | "offline" | "conflict" | "error"
  console.log("Sync status:", state.status);
});

// Check diagnostics
const diagnostics = syncProvider.getSyncDiagnostics();
console.log("Pending writes:", diagnostics.pendingCount);
```

### Using the orchestrator directly

```typescript
const orchestrator = createConfigSyncOrchestrator({
  snapshotCache,
  mutationQueue,
  transport,
});

await orchestrator.load();
await orchestrator.write("app.ui.theme", "dark");
const result = await orchestrator.sync();
// result: { status: "synced" | "partial" | "conflict", ... }
```

## API Reference

| Export | Description |
|---|---|
| `createConfigSyncOrchestrator(options)` | Create a sync orchestrator with snapshot cache, mutation queue, and transport |
| `SyncableStorageProviderAdapter` | Wraps orchestrator into a `ConfigurationStorageProvider` with sync state |
| `createSyncableStorageProviderAdapter(options)` | Factory function for the adapter |

### Types

| Type | Description |
|---|---|
| `ConfigSyncOrchestrator` | Core orchestrator interface (load, write, remove, sync, setOnline) |
| `ConfigSyncOrchestratorOptions` | Options: snapshot cache, mutation queue, transport, retry policy |
| `SyncableConfigStorageProvider` | Extended provider interface with sync state and diagnostics |
| `SyncRetryPolicy` | Retry backoff configuration (`baseDelayMs`, `maxDelayMs`) |
| `SyncDiagnostics` | Pending count, last sync time, last error details |

## License

MIT
