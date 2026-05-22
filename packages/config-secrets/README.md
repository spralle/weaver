# @weaver-conf/config-secrets

> Server-side secret resolution for Weaver configuration — pluggable providers, caching, and audit logging.

## Installation

```bash
bun add @weaver-conf/config-secrets
```

## Usage

```typescript
import { createSecretResolutionService, createSecretCache } from "@weaver-conf/config-secrets";

const service = createSecretResolutionService({
  providers: [myVaultProvider],
  cache: createSecretCache({ ttlMs: 60_000 }),
});

const result = await service.resolve("database.password");
```

## API

- `createSecretResolutionService(options)` — Creates a service that resolves secret references through configured providers
- `createSecretCache(options)` — Creates a TTL-based cache for resolved secrets
- `createAzureKeyVaultProvider(options)` — Azure Key Vault secret provider with circuit breaker support
- `SecretProvider` — Interface for implementing custom secret backends
- `SecretResolutionError` — Typed error for resolution failures

## License

MIT
