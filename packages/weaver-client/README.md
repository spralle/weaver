# @weaver-conf/weaver-client

> Configuration client SDK for Weaver — typed namespaces, transports, offline persistence, and real-time sync.

## Installation

```bash
bun add @weaver-conf/weaver-client
```

## Usage

```typescript
import { createWeaverClient, createHttpTransport, defineNamespace } from "@weaver-conf/weaver-client";
import { z } from "zod";

// Define a typed namespace
const theme = defineNamespace("theme", {
  mode: z.enum(["light", "dark"]),
  accent: z.string(),
});

// Create client with HTTP transport
const client = await createWeaverClient({
  transport: createHttpTransport({ baseUrl: "http://localhost:3399" }),
});

// Use typed namespace API
const ns = client.namespace(theme);
const mode = ns.get("mode"); // typed as "light" | "dark" | undefined
```

## API

### Client

- `createWeaverClient(options)` — Creates a connected client with transport, persistence, and schema validation
- `WeaverClient` — Main interface for reading, writing, and subscribing to configuration

### Namespaces

- `defineNamespace(prefix, shape)` — Declares a typed configuration namespace with a Zod schema
- `TypedNamespaceClient` — Strongly-typed get/set/onChange for a namespace

### Transports

- `createHttpTransport(options)` — HTTP/SSE transport connecting to weaver-server
- `createLocalTransport(options)` — In-memory transport for testing and offline use
- `withMiddleware(transport, ...middlewares)` — Wraps a transport with lifecycle hooks
- `WeaverTransport` — Interface for implementing custom transports

### Persistence

- `createFileSystemPersistence(options)` — Node.js file-based offline cache
- `createIndexedDbPersistence(options)` — Browser IndexedDB offline cache

### Utilities

- `createScopeLoader(options)` — Lazy/eager scope resolution
- `createStalenessMonitor(config)` — Detects stale configuration
- `createWriteQueue()` — Batches and deduplicates writes
- `flattenObject(obj)` — Flattens nested objects to dot-path keys

## License

MIT
