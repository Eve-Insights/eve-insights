# @eve-insights/adapter-mysql

Private MySQL implementation of the
[`@eve-insights/adapter-types`](../types) `DatabaseAdapter` contract. It is
used by the Insights Next.js app and is not published.

## Local database

Start the local database from [`databases/mysql`](../../databases/mysql):

```bash
docker compose up -d
pnpm --filter @eve-insights/adapter-mysql db:migrate
MYSQL_HOST=127.0.0.1 pnpm --filter @eve-insights/adapter-mysql test:integration
```

The adapter uses Drizzle ORM over a pooled `mysql2` client. Configure
`MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, and optionally
`MYSQL_PORT` in the Insights app.

## Storage model

The canonical SQL schema is [`databases/mysql/schema.sql`](../../databases/mysql/schema.sql).
The Drizzle table definitions in `src/schema.ts` describe the same five tables:
`runs`, `evaluations`, `events`, `event_chunks`, and `sessions`.

The complete reporter callback payload is gzip-compressed and stored as base64
chunks. A SHA-256 checksum and byte count are verified before an event is
committed. Queryable run, evaluation, event, and session projections remain in
regular columns or JSON fields.

Run and event writes are idempotent. Replaying a run registration, event,
payload chunk, or commit with the same data is safe; conflicting data returns a
`conflict` error. Database connection failures return `unavailable`.
