---
"@weaver-conf/config-types": minor
"@weaver-conf/config-secrets": patch
"@weaver-conf/storage-providers": patch
"@weaver-conf/weaver-client": minor
---

Add Result<T,E> discriminated union type for fallible operations. Adopt Result pattern in secret-resolution-service and fs-provider. Add typed TransportError events to HTTP transport via onError callback.
