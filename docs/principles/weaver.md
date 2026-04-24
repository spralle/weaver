# Weaver Project Principles

Extends the universal and TypeScript principles with weaver-specific rules.

## Principles

- **Bun runtime**: Use `bun` as the package manager and script runner. Do not use `npm run` or `yarn`.
- **Turborepo orchestration**: Use `turbo` for cross-package builds, tests, and typechecks. Do not bypass Turborepo with manual per-package scripts.
- **Package boundaries**: Each package owns one clear domain. Do not introduce cross-cutting runtime dependencies that violate the existing dependency graph.
- **Dependency direction**: Dependencies flow upward from leaf packages (`config-types`) to composite packages (`config-providers`). Never create circular or downward dependencies.
- **Zod schemas for contracts**: Every public type at a package boundary must have a corresponding Zod schema for runtime validation. Keep schemas co-located with the types they validate.
- **Node built-in test runner**: Use `node --test` for all tests. Do not add external test frameworks without team consensus.
- **Changesets required**: Every publishable package change needs a changeset. Non-publishable changes (docs, CI, tests-only) do not.
- **Beads for tracking**: All task tracking goes through `bd`. Do not create markdown TODO lists or use external trackers.

## Weaver PR Checklist (extends universal + TypeScript)

- [ ] Package boundaries and dependency direction preserved.
- [ ] Zod schemas exist for new/changed public types.
- [ ] `bun run build` and `bun run typecheck` pass.
- [ ] Changeset included (or justified why not).
