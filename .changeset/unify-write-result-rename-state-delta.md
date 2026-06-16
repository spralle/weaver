---
"@weaver-conf/config-types": major
"@weaver-conf/config-engine": major
"@weaver-conf/config-runtime": major
"@weaver-conf/weaver-client": major
"@weaver-conf/weaver-server": major
"@weaver-conf/storage-providers": major
"@weaver-conf/storage-provider-static-json": major
"@weaver-conf/storage-provider-local-storage": major
"@weaver-conf/transport-scomp": major
---

Unify WriteResult type and rename config-runtime ConfigDelta

**Breaking changes:**

- `WriteResult.error` is now a structured object `{ code: string; message: string; details?: Record<string, unknown> }` instead of a plain string. All consumers checking `result.error` must update to access `result.error.message` or `result.error.code`.
- `config-runtime` renames `ConfigDelta` to `StateDelta` and `ConfigDeltaSchema` to `StateDeltaSchema` to avoid collision with the transport-level `ConfigDelta` in `config-types`.
- `weaver-client` no longer defines its own `WriteResult`; it re-exports from `@weaver-conf/config-types`.
