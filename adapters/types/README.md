# @eve-insights/adapter-types

Shared types the adapters under `adapters/` are written against. Private — never
published; consumed over `workspace:*`.

```bash
pnpm --filter @eve-insights/adapter-types build
pnpm --filter @eve-insights/adapter-types test:watch
```

Builds with tsup to `dist/` (ESM plus declarations). It exports the
database-neutral `DatabaseAdapter` contract plus the JSON-safe run, evaluation,
session, event, and payload manifest records used by every adapter.

The HTTP wire format is intentionally owned by the published reporter package,
not this private package. See [`../README.md`](../README.md) for adapter
conventions.
