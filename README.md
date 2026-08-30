# Eve Insights

[![CI](https://github.com/Eve-Insights/eve-insights/actions/workflows/ci.yml/badge.svg)](https://github.com/Eve-Insights/eve-insights/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Telemetry and reporting for [Eve](https://eve.dev) agent evals — think Sorry Cypress, but for Eve.

Run your evals, ship the results somewhere you own, and see how your agent's quality moves over time.

> **Status: foundation.** The repository is scaffolded and the tooling works
> end to end, but the product itself is not built yet. See
> [Roadmap](#roadmap) for what lands next.

## Workspaces

| Workspace | Package | Port | Role |
| --- | --- | --- | --- |
| `apps/insights` | `@eve-insights/insights` | 3000 | The product — receives eval telemetry and reports on it |
| `apps/web` | `@eve-insights/web` | 3001 | Marketing site and documentation ([fumadocs](https://fumadocs.dev)) |
| `apps/eve` | `@eve-insights/eve` | 3002 | Example Eve agent; doubles as our test fixture |
| `packages/reporter` | `@eve-insights/reporter` | — | Library that ships Eve eval results to the platform |
| `adapters/types` | `@eve-insights/adapter-types` | — | Shared types for the internal `adapters/*` libraries ([conventions](./adapters/README.md)) |
| `adapters/firestore` | `@eve-insights/adapter-firestore` | — | Firestore persistence adapter used by Insights |
| `adapters/mysql` | `@eve-insights/adapter-mysql` | — | MySQL persistence adapter used by Insights |
| `adapters/sqlite` | `@eve-insights/adapter-sqlite` | — | SQLite persistence adapter used by Insights |
| `adapters/supabase` | `@eve-insights/adapter-supabase` | — | Supabase persistence adapter used by Insights |

Only `@eve-insights/reporter` is published to npm. Everything else is private —
`packages/*` is what ships to users, `adapters/*` is what only ever runs in this repo.

## Quickstart

Requires **Node 24** (see `.nvmrc`) and **pnpm**.

```bash
git clone https://github.com/Eve-Insights/eve-insights.git
cd eve-insights
pnpm install
pnpm dev
```

`pnpm dev` starts every app at once. To run just one:

```bash
pnpm --filter @eve-insights/insights dev
```

## Vercel deployments

Each app is deployed as its own Vercel project from this repository:

- `apps/insights`
- `apps/web`
- `apps/eve`

For each Vercel project, set the Root Directory to the corresponding app path
and enable **Include source files outside of the Root Directory in the Build
Step**. Leave the Install Command automatic so Vercel installs from the
repository root and preserves pnpm workspace linking.

The app-level `vercel.json` files run the matching package through the root
Turborepo and use `turbo-ignore` to skip deployments when the app and its
workspace dependencies are unchanged. Vercel provides the Turborepo Remote
Cache automatically for builds running on Vercel.

When an app starts consuming an internal package, declare that dependency with
the `workspace:*` protocol. Turborepo will then build the dependency first and
Vercel will include changes to it when deciding whether the app is affected.

## Commands

Run from the repository root; each is a [Turborepo](https://turborepo.com) task across all workspaces.

| Command | Description |
| --- | --- |
| `pnpm dev` | Start every app in watch mode |
| `pnpm build` | Build every workspace |
| `pnpm test` | Run every Vitest suite |
| `pnpm eval` | Run the Eve eval suite in `apps/eve` (live model calls). Forwards `AI_GATEWAY_API_KEY`, `VERCEL_OIDC_TOKEN`, `EVE_INSIGHTS_URL`, and `EVE_INSIGHTS_AGENT_NAME`. |
| `pnpm typecheck` | Typecheck every workspace |
| `pnpm lint` | Check formatting and lint rules with [Biome](https://biomejs.dev) |
| `pnpm lint:fix` | Apply safe lint and formatting fixes |
| `pnpm commit` | Guided conventional-commit prompt |

## Evals

`apps/eve` is a small weather-station agent whose job is to exercise **every** eval
surface Eve offers — each assertion family, both severities, all four LLM judges, the
full matcher language, human-in-the-loop approvals, cancellation, schedules, and dataset
fan-out. It is the fixture `@eve-insights/reporter` is built against.

```bash
pnpm --filter @eve-insights/eve eval --list                          # what exists
pnpm --filter @eve-insights/eve eval --exclude-tag model-dependent   # the stable core
pnpm --filter @eve-insights/eve eval --strict --junit .eve/junit.xml # how CI would run it
```

Evals drive a real agent against a live model, so they cost tokens and need
`AI_GATEWAY_API_KEY` or a valid `VERCEL_OIDC_TOKEN` in the environment. Root
`pnpm eval` forwards those credentials plus `EVE_INSIGHTS_URL` and
`EVE_INSIGHTS_AGENT_NAME`. The Insights reporter is opt-in: it registers only
when `EVE_INSIGHTS_URL` is set. Evals are
deliberately **not** part of CI — `pnpm test` stays fast, free and deterministic. See
[`apps/eve/README.md`](./apps/eve/README.md) for the coverage map.

## Roadmap
- [x] Versioned wire-format types shared between the reporter and the platform
- [x] `EvalReporter` implementation in `@eve-insights/reporter`
- [x] Telemetry ingest endpoint on the platform
- [x] Firestore persistence with chunked payloads
- [ ] Run history and quality-trend dashboard
- [ ] Authentication for ingestion
- [x] Supabase persistence with chunked payloads
- [x] MySQL persistence with chunked payloads
- [x] SQLite persistence with chunked payloads
- [ ] Postgres adapter

Storage is abstracted behind `@eve-insights/adapter-types`, so adapters can
replace one another without changing the reporter or HTTP API.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup,
conventions, and the commit format. Participation is governed by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) © Jim Drury
