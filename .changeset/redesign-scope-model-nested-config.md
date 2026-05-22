---
"@weaver-conf/config-types": minor
"@weaver-conf/config-engine": minor
"@weaver-conf/weaver-server": minor
"@weaver-conf/weaver-client": minor
---

Redesign: replace tenant abstraction with generic scope model, implement nested config state with deep merge semantics, add batch writes (setMany, setNamespace, PATCH /v1/config), wildcard REST routing, provider lifecycle (flush/refresh/dirty), auto-flush on writes, and SSE streaming adapter.
