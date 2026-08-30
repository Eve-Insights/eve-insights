# Contributing to Eve Insights

Thanks for taking the time to contribute.

## Prerequisites

- **Node 24** — `nvm use` picks it up from `.nvmrc`
- **pnpm** — `corepack enable` is the easiest route

## Setup

```bash
pnpm install
```

That also installs the [lefthook](https://lefthook.dev) git hooks via the
`prepare` script, so formatting and commit linting run automatically.

## Working on a workspace

Every task runs from the repository root through Turborepo:

```bash
pnpm dev          # all apps
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

Scope to one workspace with `--filter`:

```bash
pnpm --filter @eve-insights/reporter test
pnpm --filter @eve-insights/platform dev
```

## Code style

[Biome](https://biomejs.dev) handles both formatting and linting. Configuration
lives in the root `biome.json`; the Next.js apps add a small nested config that
only enables the Next/React lint domains.

`pnpm lint:fix` applies safe fixes. The pre-commit hook does this automatically
for staged files and re-stages the result, so formatting should never be
something you think about.

## Testing

Each workspace has its own [Vitest](https://vitest.dev) config — `node`
environment for the library and the agent, `jsdom` for the Next apps.

```bash
pnpm test                                     # everything
pnpm --filter @eve-insights/reporter test:watch
```

New behaviour should come with tests.

## Commits

We use the **Angular conventional commit** format. This is not cosmetic:
`semantic-release` derives every version bump and changelog entry from these
messages.

```
type(scope): subject
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`

**Scopes:** `website`, `docs`, `platform`, `agent`, `reporter`, `repo`, `ci`, `deps`

```
feat(reporter): send run summaries to the ingest endpoint
fix(platform): reject payloads without a run id
docs(repo): document the release process
```

Not sure? Run `pnpm commit` for a guided prompt.

The `commit-msg` hook rejects invalid messages, and CI validates every commit on
a pull request — so `--no-verify` will not get a badly formatted commit merged.

### How commits become releases

| Commit | Release |
| --- | --- |
| `fix(...)` | patch |
| `feat(...)` | minor |
| any commit with `BREAKING CHANGE:` in the body | major |
| `docs`, `chore`, `test`, `ci`, ... | none |

Releases are fully automated: merging to `main` publishes
`@eve-insights/reporter` and writes its changelog. Never bump versions or edit
`CHANGELOG.md` by hand.

## Pull requests

1. Branch off `main`.
2. Make sure `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
3. Open the PR and describe the change and why it is needed.

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).
