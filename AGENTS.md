# AGENTS.Md
## What this is

Telemetry and reporting for [Eve](https://eve.dev) agent evals — "Sorry Cypress, but for Eve".

**The dashboard is not built yet.** The repository now has the first telemetry
slice end to end: `@eve-insights/reporter` sends versioned, chunked eval
lifecycle data to the Insights ingest routes, and Firestore persists it behind
the adapter contract. The roadmap in `README.md` is the source of truth for
what lands next (authentication → read APIs → dashboard → more adapters).

## Layout

pnpm workspaces (`apps/*`, `packages/*`, `adapters/*`) orchestrated by Turborepo.
Node 24 (`.nvmrc`), pnpm 11.

| Path | Package | Port | Role |
| --- | --- | --- | --- |
| `apps/insights` | `@eve-insights/insights` | 3000 | Next 16 app — receives eval telemetry and reports on it |
| `apps/web` | `@eve-insights/web` | 3001 | fumadocs site — marketing landing in `src/app/(home)`, docs in `src/app/docs` from MDX under `content/docs` |
| `apps/eve` | `@eve-insights/eve` | 3002 | Example eve agent; doubles as the test fixture |
| `packages/reporter` | `@eve-insights/reporter` | — | tsup library, ships eval results to the platform |
| `adapters/types` | `@eve-insights/adapter-types` | — | First of the private `adapters/*` libraries `apps/insights` is built from |
| `adapters/firestore` | `@eve-insights/adapter-firestore` | — | Firestore implementation used by the Insights ingest routes |
| `adapters/mysql` | `@eve-insights/adapter-mysql` | — | MySQL implementation used by the Insights ingest routes |
| `adapters/sqlite` | `@eve-insights/adapter-sqlite` | — | SQLite implementation used by the Insights ingest routes |
| `adapters/supabase` | `@eve-insights/adapter-supabase` | — | Supabase implementation used by the Insights ingest routes |

`@eve-insights/reporter` is the **only** published package; everything else is `private: true`.
`eve` is a peer dependency there, and `external` in `tsup.config.ts` — never bundle it.

`packages/*` holds code that ships to users, `adapters/*` code that only runs here.
`adapters/<name>` is `@eve-insights/adapter-<name>`, tsup-built to `dist` like the reporter
but ESM-only, since nothing there is published — see `adapters/README.md`.

## Commands

Run from the root; each is a Turborepo task fanned out across workspaces.

```bash
pnpm dev          # every app at once
pnpm build
pnpm test
pnpm eval         # eve evals; live model calls, so not part of CI
pnpm typecheck
pnpm lint         # biome check .
pnpm lint:fix     # safe fixes + format
pnpm commit       # guided conventional-commit prompt (cz-git)
```

Scope to one workspace with `--filter`:

```bash
pnpm --filter @eve-insights/insights dev
pnpm --filter @eve-insights/reporter test:watch
```

Single test file or test name (vitest args pass through the workspace script):

```bash
pnpm --filter @eve-insights/reporter exec vitest run src/index.test.ts
pnpm --filter @eve-insights/reporter exec vitest run -t "package name"
```

Each workspace has its own `vitest.config.ts` with a `name` (used in CI annotations):
`node` environment for the reporter and agent, `jsdom` for the Next apps.

Root `pnpm eval` forwards `AI_GATEWAY_API_KEY`, `VERCEL_OIDC_TOKEN`,
`EVE_INSIGHTS_URL`, and `EVE_INSIGHTS_AGENT_NAME`. The Insights reporter
registers only when `EVE_INSIGHTS_URL` is set.

**Evals are not vitest and are not in CI.** `apps/eve` carries the eval suite under
`apps/eve/evals/` (`*.eval.ts`, discovered by path, with one required `evals.config.ts`).
`eve eval` boots a real dev server and drives the agent against a live model, so a run
costs tokens and needs `AI_GATEWAY_API_KEY` or a fresh `VERCEL_OIDC_TOKEN`. Run it
deliberately, never as part of `pnpm test`:

```bash
pnpm --filter @eve-insights/eve eval                            # everything
pnpm --filter @eve-insights/eve eval --exclude-tag model-dependent  # the stable core
pnpm --filter @eve-insights/eve eval tools --verbose            # one directory
```

The suite exists to exercise every eval surface eve offers, so it doubles as the
reference for what `@eve-insights/reporter` will consume. See `apps/eve/README.md`.

## Tooling conventions

**Biome** does both formatting and linting. The root `biome.json` is `"root": true`;
`apps/insights` and `apps/web` each add a nested `"root": false, "extends": "//"`
config whose only job is turning on the `next` and `react` lint domains.
Keep the Biome version identical everywhere — a version skew broke lint before (`ac8e9db`).
The lefthook pre-commit hook formats and re-stages staged files, so formatting is never
something to hand-fix.

**Typecheck is not redundant with build.** `next build` typechecks itself, but `tsup`
(reporter) and `eve build` (eve) do not, which is why CI runs both. The Next apps'
typecheck script is `next typegen && tsc --noEmit`.

**`AGENTS.md` in the Next workspaces is generated** by `next dev` (see
`node_modules/next/dist/server/lib/generate-agent-files.js`) and re-created if deleted —
commit it alongside your work rather than reverting it. Their `CLAUDE.md` is just
`@AGENTS.md`. `apps/eve/AGENTS.md` is hand-written eve guidance: read
`node_modules/eve/docs/README.md` before authoring tools, channels, skills, or schedules
there. That workspace uses subpath imports — `#*` → `./agent/*`, `#evals/*` → `./evals/*`.

`.agents/skills/` holds vendored third-party agent skills pinned by `skills-lock.json`;
they are checked-in copies, not something to edit by hand.

## Commits, branching, releases

Read `CONTRIBUTING.md` before touching anything in `.github/workflows/` or
`release.config.ts` — it documents the whole model. The parts that constrain day-to-day work:

**Angular conventional commits, enforced.** `type(scope): subject`, with the scope drawn
from a fixed enum in `commitlint.config.ts`: `insights`, `web`, `eve`, `reporter`,
`adapters`, `repo`, `ci`, `deps`, `release`. semantic-release derives every version bump
from these, so CI re-lints all commits on a PR — `--no-verify` will not sneak one through.
**Never bump a version or edit `CHANGELOG.md` by hand.**

**gitflow.** `feature/*` → `develop` → `release/*` → `main`, with `main` back-merged into
`develop` automatically. `main` and `develop` are protected (PRs only, no direct pushes
except the release job's deploy-key push to `main`; both require the aggregate `CI` check);
the short-lived branches are unprotected precisely so automation can commit to them.
Branch off `develop` and open PRs against `develop` unless it is a hotfix.

**Publishing** is a job inside `ci.yml`, gated on the aggregate `CI` check.
`develop` → `beta` (pauses for environment approval), `release/*` → `rc`, `main` → `latest`.
`release/*` and `main` both commit the changelog and version, so the checked-in
`package.json` matches what that branch published — the rc on `release/*`, the stable
version on `main`. `main` requires PRs and the GitHub Actions app cannot be a ruleset
bypass actor, so the release job checks out with a write **deploy key** (`RELEASE_SSH_KEY`,
registered as a `DeployKey` bypass on the `Main` ruleset) to push. Remove the key or the
`ssh-key:` line and the release fails *after* publishing to npm.
The release job lives in `ci.yml` and not its own workflow because
npm's trusted publisher (OIDC) is bound to that exact filename — moving it breaks auth.

**CI runs only affected workspaces**, derived from `turbo run <task> --filter=...[BASE]
--dry-run=json` into a job matrix. The `lint-repo` job always runs because root config,
workflows and `.agents/` sit outside every workspace. The single `CI` job aggregates the
matrix so a required status check has something stable to point at; its `if:` conditions
are load-bearing and commented — don't "simplify" them.

Cut a release from **Actions → Cut release branch** on `develop`, not by hand.
