---
"@weaver/config-types": minor
"@weaver/config-secrets": patch
"@weaver/storage-providers": patch
"@weaver/weaver-client": minor
---

Add Result<T,E> discriminated union type for fallible operations. Adopt Result pattern in secret-resolution-service and fs-provider. Add typed TransportError events to HTTP transport via onError callback.
