---
"@weaver-conf/weaver-server": minor
---

Wire transparent mount + secret resolution into the server read path

Consumers calling `get()`, `getNamespace()`, and `resolveAll()` now receive
fully resolved values — ConfigMount markers are followed through their
indirection chain and SecretReference markers are swapped for cached
plaintext. No consumer-side awareness of markers required.

- Resolution pipeline extracted to `resolution-pipeline.ts`
- `SecretBackend` option added to `WeaverConfigServiceOptions`
- Mount map + secret cache rebuilt automatically on writes
- Without a secret backend, markers pass through unchanged (graceful degradation)
