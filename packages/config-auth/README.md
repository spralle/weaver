# @weaver/config-auth

## Status: Deferred (Pre-built)

This package provides a composable authorization layer for configuration access control via the `withAuth()` pattern. It is **not currently wired** into the server runtime.

## Why it exists

The `withAuth()` function implements visibility-based read control and layer/role-based write control for configuration keys. It was built ahead of integration to validate the authorization model.

## Current server auth

The weaver-server has its own auth middleware at `packages/weaver-server/src/auth/` which handles HTTP-level authentication. This package is intended to complement that layer by providing **key-level** authorization decisions.

## Integration plan

When the server needs per-key authorization (e.g., filtering visible keys by role, enforcing write restrictions per property schema), this package will be wired into the config-service layer as a middleware/decorator around `WeaverConfigService`.

## Exports

- `withAuth(config: AuthConfig): AuthFunctions` — creates `canRead`, `canWrite`, and `filterVisibleKeys` functions bound to a role/policy configuration.
