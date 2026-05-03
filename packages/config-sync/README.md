# @weaver/config-sync

## Status: Deferred (Pre-built)

This package provides an offline-first sync orchestrator for configuration data. It is **not currently wired** into the server or client runtime.

## Why it exists

The sync orchestrator implements optimistic local writes, mutation queuing, conflict resolution, and background push/pull cycles. It was built to validate the sync protocol ahead of full integration.

## Current client sync

The weaver-client has its own `sync-transport-adapter.ts` which handles WebSocket-based real-time sync. This package is intended to replace or augment that with a more robust offline-capable sync layer.

## Integration plan

When the client needs offline-first capabilities (mutation queue persistence, retry with exponential backoff, conflict resolution), this package will be wired in as the sync backend behind the client's storage provider via `SyncableStorageProviderAdapter`.

## Exports

- `createConfigSyncOrchestrator(options)` — creates the sync orchestrator
- `SyncableStorageProviderAdapter` — wraps the orchestrator as a `ConfigurationStorageProvider`
- `createSyncableStorageProviderAdapter(options)` — factory for the adapter
