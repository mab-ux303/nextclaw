# NPM Package Release Process

Scope: publish npm packages in `packages/*`.
This does NOT cover registry/console deployment.

## Prereqs
- npm auth for this repo should come from the project-root `.npmrc` (gitignored).
- If release commands run from an isolated worktree or a different cwd, set
  `NPM_CONFIG_USERCONFIG=/absolute/path/to/<repo>/.npmrc` so npm still reads the
  project-root credentials.

## Standard flow
1) Create changeset
```bash
pnpm changeset
```

2) Bump versions + changelogs
```bash
pnpm release:version
```

3) Publish
```bash
pnpm release:publish
```

Notes:
- `release:publish` should run `release:check` (build + lint + typecheck) before publishing.
- `release:publish` should create git tags automatically.
