---
"@weaver-conf/config-runtime": minor
---

Add mount resolution, secret resolver, and scope resolver to config-runtime

- `buildMountMap` / `resolveMountedValue` / `resolveMountedNamespace`: key indirection via ConfigMount markers
- `createSecretResolver`: sync shadow-map for pre-resolved SecretReference values
- `createScopeResolver` / `createScopeCache`: multi-tenant scoped layer stack resolution with LRU cache
