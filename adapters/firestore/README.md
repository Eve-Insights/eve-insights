# @eve-insights/adapter-firestore

Private Firestore implementation of the [`@eve-insights/adapter-types`](../types)
`DatabaseAdapter` contract. It is used by the Insights Next.js app and is not
published.

## Local emulator

Start the emulator from [`databases/firebase`](../../databases/firebase):

```bash
docker compose up -d --build
FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm --filter @eve-insights/adapter-firestore test:integration
```

Pass the Firestore project ID when constructing the adapter. The adapter honors
`FIRESTORE_EMULATOR_HOST`. In production, configure Application Default
Credentials (or `GOOGLE_APPLICATION_CREDENTIALS`) for that project.

## Storage model

Each run is stored at `evalRuns/{runId}`. Queryable projections are kept small:
evaluations, sessions, and event manifests are subcollections. The complete
reporter callback payload is gzip-compressed and stored as base64 chunks below
`evalRuns/{runId}/events/{eventId}/chunks/{index}`. A SHA-256 checksum and byte
count are verified before an event is committed.

Run and event writes are idempotent. Replaying a run registration, event,
payload chunk, or commit with the same data is safe; conflicting data returns a
conflict error.

The adapter uses the Admin/server Firestore client, which bypasses Firestore
security rules. The checked-in rules are deliberately open for the local
emulator only and must not be used as production authorization.
