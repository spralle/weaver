---
"@weaver-conf/weaver-server": minor
---

Wire auth middleware into server request pipeline. When `jwtSecret` is configured, requests are authenticated via JWT and authorized through config-auth RBAC. Without `jwtSecret`, the server runs in open mode.
