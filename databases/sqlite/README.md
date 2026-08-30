# Eve Insights SQLite

Local SQLite for the Eve Insights SQLite adapter.

The schema is in [`schema.sql`](./schema.sql) and is also represented by the
adapter's Drizzle table definitions. Apply it to the file Insights points at
with `SQLITE_PATH` in [`.env`](../../apps/insights/.env.example).
