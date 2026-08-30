# Adapters

Internal libraries that `@eve-insights/insights` is built from — one workspace per
external system or concern it talks to. Nothing here is published to npm; every
adapter is `private: true` and consumed over the `workspace:*` protocol.

`packages/*` is for code that ships to users (`@eve-insights/reporter` and, so far,
nothing else). `adapters/*` is for code that only ever runs inside this repository.
Splitting them keeps the publish surface obvious: if it lives here, semantic-release
will never touch it.

| Workspace | Package | Role |
| --- | --- | --- |
| `adapters/types` | `@eve-insights/adapter-types` | Shared types the other adapters are written against |
| `adapters/firestore` | `@eve-insights/adapter-firestore` | Firestore implementation of the persistence contract |
| `adapters/mysql` | `@eve-insights/adapter-mysql` | MySQL implementation of the persistence contract |
| `adapters/sqlite` | `@eve-insights/adapter-sqlite` | SQLite implementation of the persistence contract |
| `adapters/supabase` | `@eve-insights/adapter-supabase` | Supabase implementation of the persistence contract |

## Conventions

**`adapters/<name>` is `@eve-insights/adapter-<name>`.** The prefix keeps adapters
distinguishable from `packages/*` at the import site.

**Built with tsup to `dist/`**, like `packages/reporter`, but ESM only — nothing here
is published and every consumer in the repository is ESM, so the CJS half of the
reporter's build would be dead weight. `exports` points at `dist`, not `src`, so
Turborepo's `^build` edge and the app's module resolution agree on one artifact.

**Depend on them explicitly.** Add `"@eve-insights/adapter-<name>": "workspace:*"` to
the consumer's dependencies so Turborepo and `turbo-ignore` both see the edge — an
adapter change then correctly marks the app as affected and triggers a Vercel deploy.

## Adding one

1. Copy `adapters/types` and rename it; it is the minimal shape.
2. Set the Vitest project `name` to the package's short name — CI annotations use it.
3. Declare it on the consumer with `workspace:*`, then `pnpm install`.

Commits touching this tree use the `adapters` scope: `feat(adapters): ...`.
