# Supabase emulator

Local Postgres + PostgREST for developing against without touching a hosted
Supabase project. A Caddy gateway on port 54321 rewrites `/rest/v1` the same
way hosted Supabase does, so `@supabase/supabase-js` works unchanged. Insights
talks to it with the same `SUPABASE_URL` / `SUPABASE_SECRET_KEY` pair
[Vercel Marketplace](https://vercel.com/marketplace/supabase) injects. The full
Studio / Kong / GoTrue / Realtime stack is not started.

```bash
docker compose up -d
docker compose logs -f rest
docker compose down
```

Schema is applied from [`schema.sql`](./schema.sql) on first volume create.
State lives in `./data` and is gitignored. After changing the schema, recreate
the volume:

```bash
docker compose down -v
docker compose up -d
```

| Service | Port |
| --- | --- |
| Gateway (`/rest/v1` → PostgREST) | 54321 |
| Postgres | 54322 |

Point Insights at it:

```bash
EVE_INSIGHTS_DATABASE=supabase
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

The secret key is the standard local `service_role` JWT for
`JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long`. It is
emulator-only, like the open Firebase rules. Do not use it against a hosted
project.

The adapter uses the service-role key, which bypasses row-level security. The
checked-in schema enables RLS with no `anon` policies so the secret key is the
only writer.

For the adapter integration test:

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU \
  pnpm --filter @eve-insights/adapter-supabase test:integration
```
