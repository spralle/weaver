---
"@weaver/config-types": minor
"@weaver/config-engine": minor
"@weaver/weaver-server": minor
"@weaver/weaver-client": minor
---

Redesign: replace tenant abstraction with generic scope model, implement nested config state with deep merge semantics, add batch writes (setMany, setNamespace, PATCH /v1/config), wildcard REST routing, provider lifecycle (flush/refresh/dirty), auto-flush on writes, and SSE streaming adapter.
