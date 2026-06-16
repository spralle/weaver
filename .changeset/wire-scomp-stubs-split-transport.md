---
"@weaver-conf/weaver-server": minor
"@weaver-conf/weaver-client": patch
---

Wire SCOMP service stubs to real ScopeManager and SchemaRegistry implementations. Add SchemaRegistry.listAll() for full schema retrieval. Split http-transport.ts into http-transport + sse-connection to respect 400-line limit.
