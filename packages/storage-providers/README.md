# @weaver/storage-providers

> Storage provider adapters for Weaver configuration — file system, Git, in-memory, and MongoDB backends.

## Installation

```bash
bun add @weaver/storage-providers
```

## Usage

```typescript
import { createFileSystemStorageProvider } from "@weaver/storage-providers";

const provider = createFileSystemStorageProvider({
  basePath: "./config",
});
```

## API

- `createFileSystemStorageProvider(options)` — File-system-backed storage with directory-per-layer layout
- `createGitStorageProvider(options)` — Git-backed storage with commit history and branch support
- `createGitManager(options)` — Low-level Git operations (commit, push, pull)
- `createInMemoryStorageProvider(options)` — Ephemeral in-memory storage for testing
- `createMongoDBStorageProvider(options)` — MongoDB-backed storage for distributed deployments

## License

MIT
