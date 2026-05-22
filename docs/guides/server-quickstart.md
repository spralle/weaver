# Server Quickstart

Run `@weaver-conf/weaver-server` as a standalone configuration microservice.

## Installation

```bash
bun add @weaver-conf/weaver-server
```

## Minimal Server

The fastest way to start a weaver-server instance:

```typescript
import { startWeaverServer } from "@weaver-conf/weaver-server";

const server = await startWeaverServer({ port: 3399 });
```

This starts a `Bun.serve()` HTTP server on port 3399 with in-memory storage. Useful for local development and testing, but not production — see below for persistent storage.

## Environment Variables

Configure the server via environment variables. These are validated at startup using the `serverEnvSchema`:

| Variable | Default | Description |
|----------|---------|-------------|
| `WEAVER_PORT` | `3399` | HTTP port to listen on |
| `WEAVER_CONFIG_REPO` | — | Git repository URL for config storage |
| `WEAVER_ENVIRONMENT` | `"development"` | Active environment (development, staging, production) |
| `WEAVER_GIT_TOKEN` | — | Authentication token for Git operations |
| `WEAVER_MONGO_URI` | — | MongoDB connection string for user/device layers |
| `WEAVER_JWT_SECRET` | — | Secret for JWT token verification |

Example `.env` file:

```env
WEAVER_PORT=3399
WEAVER_CONFIG_REPO=https://github.com/myorg/weaver-config.git
WEAVER_ENVIRONMENT=production
WEAVER_GIT_TOKEN=ghp_xxxxxxxxxxxx
WEAVER_MONGO_URI=mongodb://localhost:27017/weaver
WEAVER_JWT_SECRET=my-signing-secret
```

## Custom Storage Providers

Pass a `providers` array to `startWeaverServer()` to control where configuration is stored and how layers are resolved:

```typescript
import { startWeaverServer } from "@weaver-conf/weaver-server";
import {
  createFileSystemStorageProvider,
  createInMemoryStorageProvider,
  createGitStorageProvider,
} from "@weaver-conf/storage-providers";

const server = await startWeaverServer({
  port: 3399,
  providers: [
    createGitStorageProvider({
      repoUrl: "https://github.com/myorg/weaver-config.git",
      branch: "main",
      token: process.env.WEAVER_GIT_TOKEN,
      layer: "platform",
    }),
    createFileSystemStorageProvider({
      basePath: "./config/overrides",
      layer: "tenant:acme",
    }),
    createInMemoryStorageProvider({
      id: "ephemeral",
      layer: "user",
    }),
  ],
});
```

### Provider Types

- **`createGitStorageProvider(options)`** — Reads/writes config from a Git repository. Supports automatic commit and push on writes. Best for platform and tenant layers that need version history.
- **`createFileSystemStorageProvider({ basePath, layer })`** — Reads/writes JSON files from a local directory. Good for development and static overrides.
- **`createInMemoryStorageProvider({ id, layer })`** — Volatile in-memory storage. Useful for user-session layers or testing.

## REST API Surface

The server exposes the following HTTP endpoints:

### Health & Readiness

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/healthz` | Health check — returns 200 if the process is alive |
| `GET` | `/readyz` | Readiness check — returns 200 when all providers are loaded |

### Configuration

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/config?scope=...&ns=...` | Read resolved config. Filter by scope and/or namespace prefix. |
| `PUT` | `/v1/config/:key` | Write a single configuration key |
| `PATCH` | `/v1/config` | Batch write multiple keys |
| `GET` | `/v1/config/stream?ns=...` | SSE stream of configuration changes |

### Reading Config

```bash
# Get all config for a scope
curl http://localhost:3399/v1/config?scope=tenant:acme

# Get config filtered by namespace
curl http://localhost:3399/v1/config?ns=services.billing&scope=tenant:acme

# Subscribe to changes via SSE
curl -N http://localhost:3399/v1/config/stream?ns=services.billing
```

### Writing Config

```bash
# Set a single key
curl -X PUT http://localhost:3399/v1/config/services.billing.currency \
  -H "Content-Type: application/json" \
  -d '{"value": "EUR", "layer": "tenant:acme"}'

# Batch write
curl -X PATCH http://localhost:3399/v1/config \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      { "key": "services.billing.currency", "value": "EUR" },
      { "key": "services.billing.retryMax", "value": 5 }
    ],
    "layer": "tenant:acme"
  }'
```

## Production Deployment

### Docker

```dockerfile
FROM oven/bun:1.1-alpine

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --production

COPY src ./src

ENV WEAVER_PORT=3399
ENV WEAVER_ENVIRONMENT=production

EXPOSE 3399
CMD ["bun", "run", "src/main.ts"]
```

### Graceful Shutdown

The server handles `SIGTERM` gracefully:

1. Sets `/readyz` to return 503 (stops new traffic from load balancer)
2. Drains in-flight requests (configurable timeout, default 10s)
3. Closes SSE connections
4. Flushes pending Git writes
5. Exits cleanly

This integrates with Kubernetes pod termination lifecycle.

### CORS Configuration

For browser clients, configure CORS via the server options:

```typescript
const server = await startWeaverServer({
  port: 3399,
  cors: {
    allowedOrigins: ["https://app.example.com"],
    allowCredentials: true,
  },
});
```

## Full Example

A complete production-ready server with filesystem provider and audit logging:

```typescript
import { startWeaverServer } from "@weaver-conf/weaver-server";
import {
  createGitStorageProvider,
  createFileSystemStorageProvider,
} from "@weaver-conf/storage-providers";

const server = await startWeaverServer({
  port: Number(process.env.WEAVER_PORT) || 3399,
  providers: [
    createGitStorageProvider({
      repoUrl: process.env.WEAVER_CONFIG_REPO!,
      branch: "main",
      token: process.env.WEAVER_GIT_TOKEN,
      layer: "platform",
    }),
    createFileSystemStorageProvider({
      basePath: "./config/tenant-overrides",
      layer: "tenant:default",
    }),
  ],
  cors: {
    allowedOrigins: (process.env.WEAVER_CORS_ORIGINS || "").split(","),
    allowCredentials: true,
  },
  jwt: {
    secret: process.env.WEAVER_JWT_SECRET!,
  },
});

console.log(`Weaver server listening on port ${server.port}`);

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await server.close();
  process.exit(0);
});
```

## Next Steps

- [Browser Client Guide](./browser-client.md) — Connect a browser SPA to weaver-server
- [Backend Client Guide](./backend-client.md) — Connect a Node.js/Bun service to weaver-server
