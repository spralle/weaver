# @weaver-conf/transport-scomp

## 1.0.2

### Patch Changes

- [#145](https://github.com/surikaterna/weaver/pull/145) [`aea9c0c`](https://github.com/surikaterna/weaver/commit/aea9c0c38d49a75290bba0f562c249a3ccf85811) Thanks [@kennyek](https://github.com/kennyek)! - Replace bun with pnpm, vitest, and express.

- [#143](https://github.com/surikaterna/weaver/pull/143) [`53cfa8b`](https://github.com/surikaterna/weaver/commit/53cfa8b63597ef5e8fd285bc536b85f5eaf74fa6) Thanks [@spralle](https://github.com/spralle)! - Update repository metadata and add weaver-server CLI/container support.

- Updated dependencies [[`aea9c0c`](https://github.com/surikaterna/weaver/commit/aea9c0c38d49a75290bba0f562c249a3ccf85811), [`53cfa8b`](https://github.com/surikaterna/weaver/commit/53cfa8b63597ef5e8fd285bc536b85f5eaf74fa6)]:
  - @weaver-conf/config-types@1.0.1

## 1.0.1

### Patch Changes

- [#139](https://github.com/spralle/weaver/pull/139) [`bdb19fe`](https://github.com/spralle/weaver/commit/bdb19fe3fe3526bb6d49aba5f5aa734cc8c9e04d) Thanks [@spralle](https://github.com/spralle)! - Update SCOMP runtime dependencies to `@scompr/*` 0.2.0.

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
