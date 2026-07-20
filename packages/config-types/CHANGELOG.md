# @weaver-conf/config-types

## 1.0.1

### Patch Changes

- [#145](https://github.com/surikaterna/weaver/pull/145) [`aea9c0c`](https://github.com/surikaterna/weaver/commit/aea9c0c38d49a75290bba0f562c249a3ccf85811) Thanks [@kennyek](https://github.com/kennyek)! - Replace bun with pnpm, vitest, and express.

- [#143](https://github.com/surikaterna/weaver/pull/143) [`53cfa8b`](https://github.com/surikaterna/weaver/commit/53cfa8b63597ef5e8fd285bc536b85f5eaf74fa6) Thanks [@spralle](https://github.com/spralle)! - Update repository metadata and add weaver-server CLI/container support.

## 1.0.0

### Major Changes

- [#130](https://github.com/spralle/weaver/pull/130) [`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4) Thanks [@spralle](https://github.com/spralle)! - Unify WriteResult type and rename config-runtime ConfigDelta

  **Breaking changes:**

  - `WriteResult.error` is now a structured object `{ code: string; message: string; details?: Record<string, unknown> }` instead of a plain string. All consumers checking `result.error` must update to access `result.error.message` or `result.error.code`.
  - `config-runtime` renames `ConfigDelta` to `StateDelta` and `ConfigDeltaSchema` to `StateDeltaSchema` to avoid collision with the transport-level `ConfigDelta` in `config-types`.
  - `weaver-client` no longer defines its own `WriteResult`; it re-exports from `@weaver-conf/config-types`.

### Patch Changes

- [#130](https://github.com/spralle/weaver/pull/130) [`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4) Thanks [@spralle](https://github.com/spralle)! - Consolidate DRY violations: deepEqual, scope path formatting, matchGlob, SchemaOptions, and Unsubscribe type now have single canonical definitions.

## 0.1.0

### Minor Changes

- [`0f352bc`](https://github.com/spralle/weaver/commit/0f352bc0dbd3c7f8eda9cd5854224bc681236349) Thanks [@spralle](https://github.com/spralle)! - Initial release of the Weaver configuration library. Provides a fully generic, consumer-declarable layered configuration system with deep merge semantics, scope hierarchies, schema validation, and composable extensions for auth, policy, secrets, and sessions.

- [#20](https://github.com/spralle/weaver/pull/20) [`c650157`](https://github.com/spralle/weaver/commit/c6501578df1f59960c2259b0e19f904a3b284b6b) Thanks [@spralle](https://github.com/spralle)! - Redesign: replace tenant abstraction with generic scope model, implement nested config state with deep merge semantics, add batch writes (setMany, setNamespace, PATCH /v1/config), wildcard REST routing, provider lifecycle (flush/refresh/dirty), auto-flush on writes, and SSE streaming adapter.

- [#102](https://github.com/spralle/weaver/pull/102) [`308bf19`](https://github.com/spralle/weaver/commit/308bf190e26c9b0586b419b74aa3bab200898de5) Thanks [@spralle](https://github.com/spralle)! - Add Result<T,E> discriminated union type for fallible operations. Adopt Result pattern in secret-resolution-service and fs-provider. Add typed TransportError events to HTTP transport via onError callback.

- [#6](https://github.com/spralle/weaver/pull/6) [`af3178c`](https://github.com/spralle/weaver/commit/af3178cf65828a755d61e49f2a6ce87784124967) Thanks [@spralle](https://github.com/spralle)! - Add pluggable scope resolution cache for efficient batch getForScope() calls.
  New ScopeResolutionCache interface, built-in LRU implementation via createScopeResolutionCache(),
  and opt-in scopeCache option on ConfigurationServiceOptions.

## 0.1.0-pre.0

### Minor Changes

- [`0f352bc`](https://github.com/spralle/weaver/commit/0f352bc0dbd3c7f8eda9cd5854224bc681236349) Thanks [@spralle](https://github.com/spralle)! - Initial release of the Weaver configuration library. Provides a fully generic, consumer-declarable layered configuration system with deep merge semantics, scope hierarchies, schema validation, and composable extensions for auth, policy, secrets, and sessions.

- [#20](https://github.com/spralle/weaver/pull/20) [`c650157`](https://github.com/spralle/weaver/commit/c6501578df1f59960c2259b0e19f904a3b284b6b) Thanks [@spralle](https://github.com/spralle)! - Redesign: replace tenant abstraction with generic scope model, implement nested config state with deep merge semantics, add batch writes (setMany, setNamespace, PATCH /v1/config), wildcard REST routing, provider lifecycle (flush/refresh/dirty), auto-flush on writes, and SSE streaming adapter.

- [#102](https://github.com/spralle/weaver/pull/102) [`308bf19`](https://github.com/spralle/weaver/commit/308bf190e26c9b0586b419b74aa3bab200898de5) Thanks [@spralle](https://github.com/spralle)! - Add Result<T,E> discriminated union type for fallible operations. Adopt Result pattern in secret-resolution-service and fs-provider. Add typed TransportError events to HTTP transport via onError callback.

- [#6](https://github.com/spralle/weaver/pull/6) [`af3178c`](https://github.com/spralle/weaver/commit/af3178cf65828a755d61e49f2a6ce87784124967) Thanks [@spralle](https://github.com/spralle)! - Add pluggable scope resolution cache for efficient batch getForScope() calls.
  New ScopeResolutionCache interface, built-in LRU implementation via createScopeResolutionCache(),
  and opt-in scopeCache option on ConfigurationServiceOptions.
