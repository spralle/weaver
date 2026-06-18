# Publishing packages

Weaver uses Changesets to publish packages from the `Publish` GitHub Actions workflow.

## Required GitHub secret

Configure this repository secret:

- `CHANGESETS_TOKEN` — GitHub token used by `changesets/action` to create and update release pull requests.

`CHANGESETS_TOKEN` must be either:

- a fine-grained personal access token scoped to this repository, or
- an already-minted GitHub App installation token.

Required GitHub permissions:

- Contents: read/write
- Pull requests: read/write

Do not use the default `GITHUB_TOKEN` for release PR creation when repository or organization policy disables "GitHub Actions can create and approve pull requests". In that configuration, GitHub returns:

```text
GitHub Actions is not permitted to create or approve pull requests.
```

The workflow deliberately reads `CHANGESETS_TOKEN` into the `GITHUB_TOKEN` environment variable because `changesets/action` expects that environment name.

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

1. installs dependencies with Bun,
2. builds the monorepo,
3. creates/updates the Changesets release PR when changesets exist, or
4. runs a separate `npm publish --access public --workspaces --if-present` step through trusted publishing when the release PR has been merged.

The workflow uses `actions/checkout@v5` to avoid Node.js 20 action-runtime deprecation warnings.

## Relation to scheman

The release workflow follows the same trusted-publishing structure as `../scheman`:

1. `changesets/action` is responsible for version PR creation only.
2. npm publishing happens in a separate `npm publish --access public --workspaces --if-present` step.
3. `actions/setup-node` configures the npm registry before publishing.

Weaver differs only in using `CHANGESETS_TOKEN` for the Changesets step because this repository policy prevents the default `GITHUB_TOKEN` from creating pull requests.
