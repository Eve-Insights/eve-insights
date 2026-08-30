# @eve-insights/adapter-sqlite

Private SQLite implementation of the
[`@eve-insights/adapter-types`](../types) `DatabaseAdapter` contract. It is
used by the Insights Next.js app and is not published.

## Local database

The schema is [`databases/sqlite/schema.sql`](../../databases/sqlite/schema.sql).
Apply it to the file Insights points at with `SQLITE_PATH`, then:

```bash
pnpm --filter @eve-insights/adapter-sqlite test:integration
```

The adapter uses Drizzle ORM over a `@libsql/client` connection. Pass `path`
when constructing `SqliteAdapter`. Insights reads that path from `.env`.

## Storage model

The Drizzle table definitions in `src/schema.ts` describe the same five tables
as the SQL schema: `runs`, `evaluations`, `events`, `event_chunks`, and
`sessions`.

The complete reporter callback payload is gzip-compressed and stored as base64
chunks. A SHA-256 checksum and byte count are verified before an event is
committed. Queryable run, evaluation, event, and session projections remain in
regular columns or JSON fields.

Run and event writes are idempotent. Replaying a run registration, event,
payload chunk, or commit with the same data is safe; conflicting data returns a
`conflict` error. Database connection failures return `unavailable`.
