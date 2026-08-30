# @eve-insights/adapter-supabase

Private Supabase implementation of the [`@eve-insights/adapter-types`](../types)
`DatabaseAdapter` contract. It is used by the Insights Next.js app and is not
published.

## Local emulator

Start the emulator from [`databases/supabase`](../../databases/supabase):

```bash
docker compose up -d
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU \
  pnpm --filter @eve-insights/adapter-supabase test:integration
```

Pass the project URL and secret key when constructing the adapter. Those names
match [Vercel Marketplace Supabase](https://vercel.com/marketplace/supabase).

## Storage model

Each run is stored in `eval_runs`. Queryable projections are kept small:
evaluations, sessions, and event manifests are sibling tables. The complete
reporter callback payload is gzip-compressed and stored as base64 chunks in
`event_chunks`. A SHA-256 checksum and byte count are verified before an event
is committed.

Run and event writes are idempotent. Replaying a run registration, event,
payload chunk, or commit with the same data is safe; conflicting data returns a
conflict error.

The adapter uses the service-role key, which bypasses row-level security. The
checked-in schema enables RLS with no `anon` policies so the secret key is the
only writer. Do not use the emulator JWT against a hosted project.
