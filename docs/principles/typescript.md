# TypeScript Code Principles

Extends the universal principles with TypeScript-specific rules.

## Principles

- **Strict types**: Prefer explicit, narrow types. Use discriminated unions at domain boundaries. Avoid widening types for convenience.
- **No explicit `any`**: Use `unknown` with type narrowing instead. Document exceptions when `any` is genuinely unavoidable.
- **Named exports by default**: No default exports in production source unless a framework requires it (e.g., Next.js pages, Vite config).
- **No type assertions unless proven safe**: Prefer type guards and narrowing over `as` casts. Every assertion is a potential runtime bug.
- **Type-heavy boundaries**: Use narrow domain types and typed interfaces at adapter/builder boundaries. Let the type system enforce contracts.
- **Barrel policy**: Use barrel files (index.ts) only when they preserve clear module boundaries and do not hide dependency direction.
- **Prefer `const` and immutability**: Use `const` by default. Use `readonly` for object properties that should not change after creation.
- **Error handling**: Use typed error classes or discriminated union results at boundaries. Avoid throwing untyped errors in library code.

## TypeScript PR Checklist (extends universal)

- [ ] No explicit `any` in production source.
- [ ] No default exports (except approved framework exceptions).
- [ ] No unsafe type assertions without documented justification.
- [ ] Barrels (if used) preserve boundaries and dependency direction.
- [ ] Domain types are narrow and discriminated where appropriate.
