# Publishing packages

Weaver uses Changesets to publish packages from the `Publish` GitHub Actions workflow.

## Required secrets

Configure these repository secrets:

- `NPM_TOKEN` — npm automation token with publish access to `@weaver-conf/*` packages.
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

## Workflow behavior

On pushes to `main`, the workflow:

1. installs dependencies with Bun,
2. builds the monorepo,
3. creates/updates the Changesets release PR when changesets exist, or
4. publishes packages to npm when the release PR has been merged.

The workflow uses `actions/checkout@v5` to avoid Node.js 20 action-runtime deprecation warnings.
