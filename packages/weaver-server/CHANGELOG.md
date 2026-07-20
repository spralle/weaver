# @weaver-conf/weaver-server

## 1.0.2

### Patch Changes

- [#145](https://github.com/surikaterna/weaver/pull/145) [`aea9c0c`](https://github.com/surikaterna/weaver/commit/aea9c0c38d49a75290bba0f562c249a3ccf85811) Thanks [@kennyek](https://github.com/kennyek)! - Replace bun with pnpm, vitest, and express.

- [#143](https://github.com/surikaterna/weaver/pull/143) [`53cfa8b`](https://github.com/surikaterna/weaver/commit/53cfa8b63597ef5e8fd285bc536b85f5eaf74fa6) Thanks [@spralle](https://github.com/spralle)! - Update repository metadata and add weaver-server CLI/container support.

- Updated dependencies [[`aea9c0c`](https://github.com/surikaterna/weaver/commit/aea9c0c38d49a75290bba0f562c249a3ccf85811), [`53cfa8b`](https://github.com/surikaterna/weaver/commit/53cfa8b63597ef5e8fd285bc536b85f5eaf74fa6)]:
  - @weaver-conf/storage-providers@1.0.1
  - @weaver-conf/transport-scomp@1.0.2
  - @weaver-conf/config-runtime@1.0.1
  - @weaver-conf/config-engine@1.0.1
  - @weaver-conf/config-types@1.0.1
  - @weaver-conf/config-auth@0.1.2

## 1.0.1

### Patch Changes

- [#139](https://github.com/spralle/weaver/pull/139) [`bdb19fe`](https://github.com/spralle/weaver/commit/bdb19fe3fe3526bb6d49aba5f5aa734cc8c9e04d) Thanks [@spralle](https://github.com/spralle)! - Update SCOMP runtime dependencies to `@scompr/*` 0.2.0.

- Updated dependencies [[`bdb19fe`](https://github.com/spralle/weaver/commit/bdb19fe3fe3526bb6d49aba5f5aa734cc8c9e04d)]:
  - @weaver-conf/transport-scomp@1.0.1

## 1.0.0

### Major Changes

- [#130](https://github.com/spralle/weaver/pull/130) [`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4) Thanks [@spralle](https://github.com/spralle)! - Unify WriteResult type and rename config-runtime ConfigDelta

  **Breaking changes:**

  - `WriteResult.error` is now a structured object `{ code: string; message: string; details?: Record<string, unknown> }` instead of a plain string. All consumers checking `result.error` must update to access `result.error.message` or `result.error.code`.
  - `config-runtime` renames `ConfigDelta` to `StateDelta` and `ConfigDeltaSchema` to `StateDeltaSchema` to avoid collision with the transport-level `ConfigDelta` in `config-types`.
  - `weaver-client` no longer defines its own `WriteResult`; it re-exports from `@weaver-conf/config-types`.

### Minor Changes

- [`a0c6869`](https://github.com/spralle/weaver/commit/a0c68692c7276c46fc62c2331242093586f8b6b2) Thanks [@spralle](https://github.com/spralle)! - Wire transparent mount + secret resolution into the server read path

  Consumers calling `get()`, `getNamespace()`, and `resolveAll()` now receive
  fully resolved values — ConfigMount markers are followed through their
  indirection chain and SecretReference markers are swapped for cached
  plaintext. No consumer-side awareness of markers required.

  - Resolution pipeline extracted to `resolution-pipeline.ts`
  - `SecretBackend` option added to `WeaverConfigServiceOptions`
  - Mount map + secret cache rebuilt automatically on writes
  - Without a secret backend, markers pass through unchanged (graceful degradation)

- [#130](https://github.com/spralle/weaver/pull/130) [`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4) Thanks [@spralle](https://github.com/spralle)! - Wire SCOMP service stubs to real ScopeManager and SchemaRegistry implementations. Add SchemaRegistry.listAll() for full schema retrieval. Split http-transport.ts into http-transport + sse-connection to respect 400-line limit.

### Patch Changes

- [#132](https://github.com/spralle/weaver/pull/132) [`0217300`](https://github.com/spralle/weaver/commit/02173000516822712b76e0f6558c5609031fd8f2) Thanks [@spralle](https://github.com/spralle)! - Reject unauthenticated REST writes when JWT auth is enabled while preserving public reads.

- [#133](https://github.com/spralle/weaver/pull/133) [`df639a0`](https://github.com/spralle/weaver/commit/df639a04c41d6c885b6662c86921e628845172c3) Thanks [@spralle](https://github.com/spralle)! - Wire startWeaverServer to load providers from the existing single-repo bootstrap configuration when repoUrl is supplied.

- [#130](https://github.com/spralle/weaver/pull/130) [`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4) Thanks [@spralle](https://github.com/spralle)! - Consolidate DRY violations: deepEqual, scope path formatting, matchGlob, SchemaOptions, and Unsubscribe type now have single canonical definitions.

- [#135](https://github.com/spralle/weaver/pull/135) [`f205f45`](https://github.com/spralle/weaver/commit/f205f45c220f9ef207976ab35adec426d9731859) Thanks [@spralle](https://github.com/spralle)! - Add an async persistent schema registry factory that hydrates schemas from config storage and persists successful registrations.

- Updated dependencies [[`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4), [`55d25c9`](https://github.com/spralle/weaver/commit/55d25c97b5615ef8ebb987220cb48cc23b9acdf1), [`f2abae4`](https://github.com/spralle/weaver/commit/f2abae4c382dab04bb7e6cf7bb9b96df7cd783f4)]:
  - @weaver-conf/config-types@1.0.0
  - @weaver-conf/config-engine@1.0.0
  - @weaver-conf/config-runtime@1.0.0
  - @weaver-conf/storage-providers@1.0.0
  - @weaver-conf/transport-scomp@1.0.0
  - @weaver-conf/config-auth@0.1.1

## 0.1.0

### Minor Changes

- [`0f352bc`](https://github.com/spralle/weaver/commit/0f352bc0dbd3c7f8eda9cd5854224bc681236349) Thanks [@spralle](https://github.com/spralle)! - Initial release of the Weaver configuration library. Provides a fully generic, consumer-declarable layered configuration system with deep merge semantics, scope hierarchies, schema validation, and composable extensions for auth, policy, secrets, and sessions.

- [#20](https://github.com/spralle/weaver/pull/20) [`c650157`](https://github.com/spralle/weaver/commit/c6501578df1f59960c2259b0e19f904a3b284b6b) Thanks [@spralle](https://github.com/spralle)! - Redesign: replace tenant abstraction with generic scope model, implement nested config state with deep merge semantics, add batch writes (setMany, setNamespace, PATCH /v1/config), wildcard REST routing, provider lifecycle (flush/refresh/dirty), auto-flush on writes, and SSE streaming adapter.

- [#21](https://github.com/spralle/weaver/pull/21) [`d81bb9f`](https://github.com/spralle/weaver/commit/d81bb9f73aeaa091c763ae80364610d615ad37ea) Thanks [@spralle](https://github.com/spralle)! - Wire server entry point with REST/SSE adapters, add Zod request validation, implement Git revert rollback, and build HTTP+SSE transport for weaver-client.

### Patch Changes

- [#39](https://github.com/spralle/weaver/pull/39) [`3c0b9df`](https://github.com/spralle/weaver/commit/3c0b9df2d4594e15c9ee872d1fe2ff38fe549bfe) Thanks [@spralle](https://github.com/spralle)! - Extract storage providers into dedicated @weaver-conf/storage-providers package (SRP)

- [#101](https://github.com/spralle/weaver/pull/101) [`6799071`](https://github.com/spralle/weaver/commit/6799071dd7fbb40c6d6247694bfa63713d8b029f) Thanks [@spralle](https://github.com/spralle)! - Add path traversal guard, regex caching, and ReDoS safety checks

- Updated dependencies [[`3c0b9df`](https://github.com/spralle/weaver/commit/3c0b9df2d4594e15c9ee872d1fe2ff38fe549bfe), [`0f352bc`](https://github.com/spralle/weaver/commit/0f352bc0dbd3c7f8eda9cd5854224bc681236349), [`4207041`](https://github.com/spralle/weaver/commit/42070418fc4636aa928d3e786fe10e5c7ebd1dcd), [`a72884d`](https://github.com/spralle/weaver/commit/a72884d9f30d7d08f698af4ba56b2d3d324f875d), [`c650157`](https://github.com/spralle/weaver/commit/c6501578df1f59960c2259b0e19f904a3b284b6b), [`308bf19`](https://github.com/spralle/weaver/commit/308bf190e26c9b0586b419b74aa3bab200898de5), [`af3178c`](https://github.com/spralle/weaver/commit/af3178cf65828a755d61e49f2a6ce87784124967), [`6799071`](https://github.com/spralle/weaver/commit/6799071dd7fbb40c6d6247694bfa63713d8b029f)]:
  - @weaver-conf/storage-providers@0.1.0
  - @weaver-conf/config-types@0.1.0
  - @weaver-conf/config-engine@0.1.0
  - @weaver-conf/config-auth@0.0.1

## 0.1.0-pre.0

### Minor Changes

- [`0f352bc`](https://github.com/spralle/weaver/commit/0f352bc0dbd3c7f8eda9cd5854224bc681236349) Thanks [@spralle](https://github.com/spralle)! - Initial release of the Weaver configuration library. Provides a fully generic, consumer-declarable layered configuration system with deep merge semantics, scope hierarchies, schema validation, and composable extensions for auth, policy, secrets, and sessions.

- [#20](https://github.com/spralle/weaver/pull/20) [`c650157`](https://github.com/spralle/weaver/commit/c6501578df1f59960c2259b0e19f904a3b284b6b) Thanks [@spralle](https://github.com/spralle)! - Redesign: replace tenant abstraction with generic scope model, implement nested config state with deep merge semantics, add batch writes (setMany, setNamespace, PATCH /v1/config), wildcard REST routing, provider lifecycle (flush/refresh/dirty), auto-flush on writes, and SSE streaming adapter.

- [#21](https://github.com/spralle/weaver/pull/21) [`d81bb9f`](https://github.com/spralle/weaver/commit/d81bb9f73aeaa091c763ae80364610d615ad37ea) Thanks [@spralle](https://github.com/spralle)! - Wire server entry point with REST/SSE adapters, add Zod request validation, implement Git revert rollback, and build HTTP+SSE transport for weaver-client.

### Patch Changes

- [#39](https://github.com/spralle/weaver/pull/39) [`3c0b9df`](https://github.com/spralle/weaver/commit/3c0b9df2d4594e15c9ee872d1fe2ff38fe549bfe) Thanks [@spralle](https://github.com/spralle)! - Extract storage providers into dedicated @weaver-conf/storage-providers package (SRP)

- [#101](https://github.com/spralle/weaver/pull/101) [`6799071`](https://github.com/spralle/weaver/commit/6799071dd7fbb40c6d6247694bfa63713d8b029f) Thanks [@spralle](https://github.com/spralle)! - Add path traversal guard, regex caching, and ReDoS safety checks

- Updated dependencies [[`3c0b9df`](https://github.com/spralle/weaver/commit/3c0b9df2d4594e15c9ee872d1fe2ff38fe549bfe), [`0f352bc`](https://github.com/spralle/weaver/commit/0f352bc0dbd3c7f8eda9cd5854224bc681236349), [`4207041`](https://github.com/spralle/weaver/commit/42070418fc4636aa928d3e786fe10e5c7ebd1dcd), [`a72884d`](https://github.com/spralle/weaver/commit/a72884d9f30d7d08f698af4ba56b2d3d324f875d), [`c650157`](https://github.com/spralle/weaver/commit/c6501578df1f59960c2259b0e19f904a3b284b6b), [`308bf19`](https://github.com/spralle/weaver/commit/308bf190e26c9b0586b419b74aa3bab200898de5), [`af3178c`](https://github.com/spralle/weaver/commit/af3178cf65828a755d61e49f2a6ce87784124967), [`6799071`](https://github.com/spralle/weaver/commit/6799071dd7fbb40c6d6247694bfa63713d8b029f)]:
  - @weaver-conf/storage-providers@0.1.0-pre.0
  - @weaver-conf/config-types@0.1.0-pre.0
  - @weaver-conf/config-engine@0.1.0-pre.0
  - @weaver-conf/config-auth@0.0.1-pre.0
