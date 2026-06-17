# @weaver-conf/transport-scomp

## 1.0.0

### Major Changes

- [#130](https://github.com/spralle/weaver/pull/130) [`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4) Thanks [@spralle](https://github.com/spralle)! - Unify WriteResult type and rename config-runtime ConfigDelta

  **Breaking changes:**

  - `WriteResult.error` is now a structured object `{ code: string; message: string; details?: Record<string, unknown> }` instead of a plain string. All consumers checking `result.error` must update to access `result.error.message` or `result.error.code`.
  - `config-runtime` renames `ConfigDelta` to `StateDelta` and `ConfigDeltaSchema` to `StateDeltaSchema` to avoid collision with the transport-level `ConfigDelta` in `config-types`.
  - `weaver-client` no longer defines its own `WriteResult`; it re-exports from `@weaver-conf/config-types`.

### Patch Changes

- [#130](https://github.com/spralle/weaver/pull/130) [`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4) Thanks [@spralle](https://github.com/spralle)! - Consolidate DRY violations: deepEqual, scope path formatting, matchGlob, SchemaOptions, and Unsubscribe type now have single canonical definitions.

- Updated dependencies [[`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4), [`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4)]:
  - @weaver-conf/config-types@1.0.0
