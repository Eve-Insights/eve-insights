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

Only `@eve-insights/reporter` is published to npm. Everything else is private.

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
| `pnpm typecheck` | Typecheck every workspace |
| `pnpm lint` | Check formatting and lint rules with [Biome](https://biomejs.dev) |
| `pnpm lint:fix` | Apply safe lint and formatting fixes |
| `pnpm commit` | Guided conventional-commit prompt |

## Roadmap

- [ ] Wire-format types shared between the reporter and the platform
- [ ] `EvalReporter` implementation in `@eve-insights/reporter`
- [ ] Telemetry ingest endpoint on the platform
- [ ] Persistence
- [ ] Run history and quality-trend dashboard

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup,
conventions, and the commit format. Participation is governed by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) © Jim Drury
