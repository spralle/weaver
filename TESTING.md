# Testing Conventions

This monorepo uses two test file locations, each with a distinct purpose.

## `test/*.test.mjs` — Behavioral tests

Located in `packages/*/test/`. These test the **public API surface** of a package from the outside. They import only from the package's barrel export and verify observable behavior.

Use this location for:

- Integration tests exercising multiple internal modules together
- Contract tests verifying the public interface
- Any test that should survive internal refactoring

## `src/*.test.ts` — Implementation-coupled unit tests

Co-located alongside source files in `packages/*/src/`. These test **internal implementation details** that are tightly coupled to a specific module's structure.

Use this location for:

- Unit tests for private helpers or internal algorithms
- Tests that import directly from a non-exported module
- Tests that would break (and should break) when the implementation changes

## Running tests

Both patterns are discovered and executed by `pnpm run test`.

## Guidance for new tests

Place new tests in `test/` by default. Only use `src/*.test.ts` when the test is genuinely coupled to internal implementation details that are not exposed through the public API.
