# Eve Insights MySQL

Local MySQL for the Eve Insights MySQL adapter.

```bash
docker compose up -d
MYSQL_HOST=127.0.0.1 \
MYSQL_USER=eve \
MYSQL_PASSWORD=secret \
MYSQL_DATABASE=eve_insights \
pnpm --filter @eve-insights/adapter-mysql test:integration
```

The database is exposed on port `3306`. The schema is in
[`schema.sql`](./schema.sql) and is also represented by the adapter's Drizzle
table definitions.
