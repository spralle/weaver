# Weaver Consolidation Plan — 0.1.0-pre

## Key Decisions

1. **Nested JSON is the canonical storage model** — `deepGet`/`deepSet`/`deepMerge` from config-engine is the one resolution path.
2. **The 3-5 segment limit will be removed** — paths navigate document trees, depth is schema-defined.
3. **config-runtime will not ship** — weaver-server and weaver-client have their own resolution.
4. **Governance fields go under `x-weaver: {}`** — the arch-sweep PR already does this.
5. **HTTP+SSE is the primary transport** — Scomp is TBD (decision issue #34).

---

## Current Package Inventory (11 packages)

| Category | Package | Role |
|----------|---------|------|
| CORE | `@weaver/config-types` | Shared types, Zod schemas, `defineWeaver` builder |
| CORE | `@weaver/config-engine` | `deepGet`/`Set`/`Remove`/`Merge`, schema registry, JSON Schema codegen, namespace utilities |
| SERVER | `@weaver/weaver-server` | Server process (storage, auth, transport, core service) |
| CLIENT | `@weaver/weaver-client` | Client SDK (transport, local state, persistence) |
| LIBRARY | `@weaver/config-providers` | Concrete storage providers (InMemory, StaticJson, LocalStorage) |
| LIBRARY | `@weaver/config-auth` | `withAuth()` role-based access |
| LIBRARY | `@weaver/config-policy` | Change policy evaluation |
| LIBRARY | `@weaver/config-sessions` | Override sessions |
| LIBRARY | `@weaver/config-server` | FileSystemStorageProvider, audit log, service config |
| QUESTIONABLE | `@weaver/config-sync` | Offline sync (not wired into weaver-client, see issue #35) |
| QUESTIONABLE | `@weaver/config-runtime` | Flat-key orchestration (broken, will be deleted and rebuilt) |
| APP | `@weaver/demo` | Interactive demo (private, GitHub Pages) |

---

## Phase 1: Land arch-sweep (prerequisite)

**Goal:** Merge PR #23, establishing the foundation for all subsequent work.

- Fix remaining lint errors in arch-sweep branch
- Merge PR #23 into main
- **Gets us:**
  - `x-weaver` schema governance fields
  - `config-audit` extraction
  - Dependency cleanup
  - Bug fixes across packages

**Exit criteria:** PR #23 merged, CI green on main.

---

## Phase 2: Storage model unification

**Issues:** #28, #29

**Goal:** Make nested JSON the single resolution model everywhere.

### Steps

1. **Remove 3-5 segment limit** from `validateKeyFormat` in config-types
   - Paths navigate document trees; depth is schema-defined, not hardcoded
   - Update Zod schema for `ConfigurationKey` accordingly

2. **Make `resolveConfiguration()` use `deepMerge`** in config-engine
   - Layer resolution produces a single nested document via recursive merge
   - Priority ordering remains: base < environment < override < session

3. **Update `ConfigurationLayerData.entries`** to be nested documents
   - Entries become `Record<string, unknown>` (nested JSON) instead of flat key-value pairs
   - Each layer stores a partial document tree

4. **Update config-providers state-container** to use `deepGet`/`deepSet`
   - InMemoryProvider, StaticJsonProvider, LocalStorageProvider all operate on nested state
   - Remove any flat-key iteration logic

5. **Remove `flattenObject` from weaver-client**
   - No longer needed — client receives and stores nested documents directly

**This is the core breaking change.** Acceptable since nothing is published yet.

**Exit criteria:** All tests pass with nested model, no flat-key resolution paths remain.

---

## Phase 3: Package consolidation

**Issue:** #30

**Goal:** Reduce package count, clarify boundaries, establish config-runtime as the shared orchestration layer.

### Steps

1. **Delete the current `config-runtime`**
   - The existing code is broken (stale imports, flat-key model)
   - It will be rebuilt from scratch after Phase 2

2. **Fold `config-server` INTO `weaver-server`**
   - `weaver-server` is the only consumer of `config-server`
   - Move `FileSystemStorageProvider`, audit log, and service config into `weaver-server/src/`
   - Remove `@weaver/config-server` package

3. **Fold storage providers INTO `weaver-server`**
   - InMemory, StaticJson, FS, Git, MongoDB providers are server-side storage backends
   - Move into `weaver-server/src/providers/`
   - Remove individual `@weaver/storage-provider-*` packages

4. **Extract shared orchestration into new `config-runtime`**
   - State container (holds resolved config, emits changes)
   - Layer resolution (merge layers by priority using `deepMerge`)
   - Scope application (environment/tenant/user scoping)
   - View service (subscribe to key paths, get typed values)
   - Both weaver-server and weaver-client consume this
   - weaver-client = config-runtime + HTTP/SSE transport + persistence adapters

5. **Decide `config-sync` fate** (issue #35)
   - If kept: wire into weaver-client as the offline layer
   - If removed: delete package, track as future work
   - Decision deferred to issue #35

**Exit criteria:** 8 publishable packages (or 9 if config-sync survives), clean dependency graph.

---

## Phase 4: Client hardening

**Issues:** #31, #32, #33

**Goal:** Make weaver-client production-ready for offline-first use.

1. **Offline boot resilience** (#31)
   - Client starts from local cache when server is unreachable
   - Graceful degradation with stale data indicators

2. **IndexedDB persistence** (#32)
   - Replace LocalStorage with IndexedDB for client-side cache
   - Support larger payloads and structured data

3. **Cache staleness** (#33)
   - TTL-based invalidation
   - SSE-driven cache busting when connected
   - Stale-while-revalidate semantics

**Exit criteria:** Client works offline, reconnects cleanly, persists across sessions.

---

## Phase 5: 0.1.0-pre release

**Goal:** First publishable pre-release.

1. `changeset pre enter pre`
2. `changeset version` → produces `0.1.0-pre.0` versions
3. Publish to npm (or dry-run first)
4. Git tag `v0.1.0-pre.0`

**Exit criteria:** Packages published, tagged, installable from npm.

---

## Target Package Structure (0.1.0-pre)

```
@weaver/config-types    — Types, Zod schemas, defineWeaver
@weaver/config-engine   — Primitives (deepGet/Set/Merge), schema registry, codegen
@weaver/config-runtime  — Orchestration (state container, layer resolution, scoping, views)
@weaver/config-auth     — withAuth() RBAC
@weaver/config-policy   — Change policies, ratchets
@weaver/config-sessions — Override sessions
@weaver/weaver-server   — Server (absorbs storage providers)
@weaver/weaver-client   — Opinionated SDK (config-runtime + transport + persistence)
```

**8 publishable packages** (down from ~20 post-arch-sweep).

---

## Dependency Graph (final state)

```
┌─────────────────────────────────────────────────────────────┐
│                        APPLICATIONS                          │
│                                                             │
│   @weaver/demo (private)                                    │
│       ├── weaver-server                                     │
│       └── weaver-client                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                          SERVER                              │
│                                                             │
│   @weaver/weaver-server                                     │
│       ├── config-runtime                                    │
│       ├── config-auth                                       │
│       ├── config-policy                                     │
│       └── config-sessions                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                          CLIENT                              │
│                                                             │
│   @weaver/weaver-client                                     │
│       └── config-runtime                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        LIBRARIES                             │
│                                                             │
│   @weaver/config-auth ──────────┐                           │
│   @weaver/config-policy ────────┼──► config-engine          │
│   @weaver/config-sessions ──────┘                           │
│                                                             │
│   @weaver/config-runtime ──────────► config-engine          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                           CORE                               │
│                                                             │
│   @weaver/config-engine                                     │
│       └── config-types                                      │
│                                                             │
│   @weaver/config-types (leaf — no internal deps)            │
└─────────────────────────────────────────────────────────────┘
```

**Dependency direction:** Always upward from leaves (`config-types`) to composites (`weaver-server`). No circular dependencies.

---

## Removed Packages

| Package | Disposition |
|---------|-------------|
| `@weaver/config-runtime` (current) | Deleted and rebuilt — current version uses stale flat-key model |
| `@weaver/config-server` | Absorbed into `weaver-server` |
| `@weaver/config-providers` | Absorbed into `weaver-server` |
| `@weaver/storage-provider-*` (8 packages) | Absorbed into `weaver-server` |
| `@weaver/storage-provider-core` | Absorbed into `weaver-server` |
| `@weaver/config-sync` | TBD — decision tracked in issue #35 |
