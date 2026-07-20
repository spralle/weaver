# Publishing packages

Weaver uses Changesets to publish packages from the `Publish` GitHub Actions workflow.

## GitHub token

The workflow uses the default `GITHUB_TOKEN` for `changesets/action` to create and update release pull requests:

- `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`

Workflow permissions:

- Contents: read/write
- Pull requests: read/write
- ID token: write

Repository settings must allow GitHub Actions to create pull requests. If that policy is disabled, release PR creation fails with:

```text
GitHub Actions is not permitted to create or approve pull requests.
```

## npm trusted publishing

Package publishing uses npm trusted publishing with GitHub OIDC instead of an `NPM_TOKEN`.

Configure npm trusted publishing for each published package, or for the `@weaver-conf` scope if npm supports scope-level trusted publisher configuration for the account. The trusted publisher must match:

- repository: `surikaterna/weaver`
- workflow: `.github/workflows/publish.yml`
- branch/environment: `main`

The workflow grants `id-token: write` and sets `NPM_CONFIG_PROVENANCE=true`, so npm can exchange the GitHub OIDC token for publish authorization and attach provenance.

If npm trusted publishing is not configured, publishing fails with:

```text
No NPM_TOKEN or OIDC available
ENEEDAUTH This command requires you to be logged in
```

Do not add a long-lived `NPM_TOKEN` unless trusted publishing is unavailable for the target package/scope.

## Workflow behavior

On pushes to `main`, the workflow:

1. installs dependencies with pnpm,
2. builds the monorepo,
3. creates/updates the Changesets release PR when changesets exist, or
4. runs `npx changeset publish` through trusted publishing when the release PR has been merged.

The workflow uses `actions/checkout@v5` to avoid Node.js 20 action-runtime deprecation warnings.

## Relation to scomp

The release workflow follows the same trusted-publishing structure as `../scomp`:

1. `changesets/action` is responsible for version PR creation only.
2. npm publishing happens in a separate `npx changeset publish` step.
3. `actions/setup-node` configures the npm registry before publishing.
