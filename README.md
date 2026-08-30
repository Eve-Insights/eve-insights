# Eve Insights

[![CI](https://github.com/jimdrury/eve-insights/actions/workflows/ci.yml/badge.svg)](https://github.com/jimdrury/eve-insights/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Telemetry and reporting for [Eve](https://eve.dev) agent evals — think Sorry Cypress, but for Eve.

Run your evals, ship the results somewhere you own, and see how your agent's quality moves over time.

> **Status: foundation.** The repository is scaffolded and the tooling works
> end to end, but the product itself is not built yet. See
> [Roadmap](#roadmap) for what lands next.

## Workspaces

| Workspace | Package | Port | Role |
| --- | --- | --- | --- |
| `web/website` | `@eve-insights/website` | 3003 | Marketing site |
| `web/docs` | `@eve-insights/docs` | 3001 | Documentation ([fumadocs](https://fumadocs.dev)) |
| `apps/platform` | `@eve-insights/platform` | 3000 | The reporter — receives eval telemetry and reports on it |
| `examples/agent` | `@eve-insights/agent` | 3002 | Example Eve agent; doubles as our test fixture |
| `packages/reporter` | `@eve-insights/reporter` | — | Library that ships Eve eval results to the platform |

Only `@eve-insights/reporter` is published to npm. Everything else is private.

## Quickstart

Requires **Node 24** (see `.nvmrc`) and **pnpm**.

```bash
git clone https://github.com/jimdrury/eve-insights.git
cd eve-insights
pnpm install
pnpm dev
```

`pnpm dev` starts every app at once. To run just one:

```bash
pnpm --filter @eve-insights/platform dev
```

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
