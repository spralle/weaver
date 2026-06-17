# @weaver-conf/config-runtime

## 1.0.0

### Major Changes

- [#130](https://github.com/spralle/weaver/pull/130) [`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4) Thanks [@spralle](https://github.com/spralle)! - Unify WriteResult type and rename config-runtime ConfigDelta

  **Breaking changes:**

  - `WriteResult.error` is now a structured object `{ code: string; message: string; details?: Record<string, unknown> }` instead of a plain string. All consumers checking `result.error` must update to access `result.error.message` or `result.error.code`.
  - `config-runtime` renames `ConfigDelta` to `StateDelta` and `ConfigDeltaSchema` to `StateDeltaSchema` to avoid collision with the transport-level `ConfigDelta` in `config-types`.
  - `weaver-client` no longer defines its own `WriteResult`; it re-exports from `@weaver-conf/config-types`.

### Minor Changes

- [`55d25c9`](https://github.com/spralle/weaver/commit/55d25c97b5615ef8ebb987220cb48cc23b9acdf1) Thanks [@spralle](https://github.com/spralle)! - Add mount resolution, secret resolver, and scope resolver to config-runtime

  - `buildMountMap` / `resolveMountedValue` / `resolveMountedNamespace`: key indirection via ConfigMount markers
  - `createSecretResolver`: sync shadow-map for pre-resolved SecretReference values
  - `createScopeResolver` / `createScopeCache`: multi-tenant scoped layer stack resolution with LRU cache

### Patch Changes

- [#130](https://github.com/spralle/weaver/pull/130) [`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4) Thanks [@spralle](https://github.com/spralle)! - Consolidate DRY violations: deepEqual, scope path formatting, matchGlob, SchemaOptions, and Unsubscribe type now have single canonical definitions.

- Updated dependencies [[`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4), [`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4)]:
  - @weaver-conf/config-types@1.0.0
  - @weaver-conf/config-engine@1.0.0

## 0.1.0

### Minor Changes

- [#38](https://github.com/spralle/weaver/pull/38) [`4451043`](https://github.com/spralle/weaver/commit/445104393842826747ba98aa2a2ec6f82ef2d851) Thanks [@spralle](https://github.com/spralle)! - Add new config-runtime package providing a pure state machine for configuration resolution with layer merging, path access, subscriptions, delta application, and snapshot/hydrate support.

- [`0f352bc`](https://github.com/spralle/weaver/commit/0f352bc0dbd3c7f8eda9cd5854224bc681236349) Thanks [@spralle](https://github.com/spralle)! - Initial release of the Weaver configuration library. Provides a fully generic, consumer-declarable layered configuration system with deep merge semantics, scope hierarchies, schema validation, and composable extensions for auth, policy, secrets, and sessions.

### Patch Changes

- Updated dependencies [[`0f352bc`](https://github.com/spralle/weaver/commit/0f352bc0dbd3c7f8eda9cd5854224bc681236349), [`4207041`](https://github.com/spralle/weaver/commit/42070418fc4636aa928d3e786fe10e5c7ebd1dcd), [`a72884d`](https://github.com/spralle/weaver/commit/a72884d9f30d7d08f698af4ba56b2d3d324f875d), [`c650157`](https://github.com/spralle/weaver/commit/c6501578df1f59960c2259b0e19f904a3b284b6b), [`6799071`](https://github.com/spralle/weaver/commit/6799071dd7fbb40c6d6247694bfa63713d8b029f)]:
  - @weaver-conf/config-engine@0.1.0

## 0.1.0-pre.0

### Minor Changes

- [#38](https://github.com/spralle/weaver/pull/38) [`4451043`](https://github.com/spralle/weaver/commit/445104393842826747ba98aa2a2ec6f82ef2d851) Thanks [@spralle](https://github.com/spralle)! - Add new config-runtime package providing a pure state machine for configuration resolution with layer merging, path access, subscriptions, delta application, and snapshot/hydrate support.

- [`0f352bc`](https://github.com/spralle/weaver/commit/0f352bc0dbd3c7f8eda9cd5854224bc681236349) Thanks [@spralle](https://github.com/spralle)! - Initial release of the Weaver configuration library. Provides a fully generic, consumer-declarable layered configuration system with deep merge semantics, scope hierarchies, schema validation, and composable extensions for auth, policy, secrets, and sessions.

### Patch Changes

- Updated dependencies [[`0f352bc`](https://github.com/spralle/weaver/commit/0f352bc0dbd3c7f8eda9cd5854224bc681236349), [`4207041`](https://github.com/spralle/weaver/commit/42070418fc4636aa928d3e786fe10e5c7ebd1dcd), [`a72884d`](https://github.com/spralle/weaver/commit/a72884d9f30d7d08f698af4ba56b2d3d324f875d), [`c650157`](https://github.com/spralle/weaver/commit/c6501578df1f59960c2259b0e19f904a3b284b6b), [`6799071`](https://github.com/spralle/weaver/commit/6799071dd7fbb40c6d6247694bfa63713d8b029f)]:
  - @weaver-conf/config-engine@0.1.0-pre.0
