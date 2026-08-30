# @eve-insights/insights

The product: the Next app that receives eval telemetry from
[`@eve-insights/reporter`](../../packages/reporter) and reports on it. Runs on port 3000.

```bash
pnpm --filter @eve-insights/insights dev
```

## Ingestion

The app accepts unauthenticated Eve reporter traffic at:

- `POST /api/v1/runs` — register a run
- `POST /api/v1/runs/{runId}/events` — stage an event manifest
- `POST /api/v1/runs/{runId}/events/{eventId}/chunks` — upload a payload chunk
- `POST /api/v1/runs/{runId}/events/{eventId}/commit` — verify and commit an event

Firestore is selected by default. Set `EVE_INSIGHTS_DATABASE=firestore` and
configure `FIREBASE_PROJECT_ID` for a real project, or set
`FIRESTORE_EMULATOR_HOST=localhost:8080` when using the local emulator in
[`databases/firebase`](../../databases/firebase). The server client uses
Application Default Credentials outside the emulator.

For Supabase, set `EVE_INSIGHTS_DATABASE=supabase` with `SUPABASE_URL` and
`SUPABASE_SECRET_KEY` (the Vercel Marketplace names). The local PostgREST
emulator is in [`databases/supabase`](../../databases/supabase).

For MySQL, set `EVE_INSIGHTS_DATABASE=mysql` with the `MYSQL_*` connection
vars. The local database is in [`databases/mysql`](../../databases/mysql).

For SQLite, set `EVE_INSIGHTS_DATABASE=sqlite` and `SQLITE_PATH` in `.env`.
The local database file is in [`databases/sqlite`](../../databases/sqlite).

Authentication and public read APIs are intentionally not implemented yet. The
homepage reads the agent list directly on the server. Do not expose this
ingestion endpoint publicly with sensitive data until authentication and
production authorization are added.
