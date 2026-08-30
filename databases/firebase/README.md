# Firebase emulator

Local Firebase suite (Auth, Firestore, Realtime Database, Storage, Pub/Sub) for
developing against without touching a real project. There is no official emulator
image, so `Dockerfile` builds one from `firebase-tools` plus a headless JRE.

```bash
docker compose up -d --build     # start (first build downloads the emulator jars)
docker compose logs -f emulator  # follow
docker compose down              # stop; state is exported to ./data on shutdown
```

UI at http://localhost:4000. State in `./data` is re-imported on the next start and
is gitignored — commit a seed export deliberately if you want a shared fixture.

| Emulator | Port |
| --- | --- |
| UI | 4000 |
| Hub | 4400 |
| Logging | 4500 |
| Firestore | 8080 |
| Pub/Sub | 8085 |
| Realtime Database | 9000 |
| Auth | 9099 |
| Storage | 9199 |

Point a client at it with the standard emulator env vars:

```bash
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_DATABASE_EMULATOR_HOST=localhost:9000
FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199
PUBSUB_EMULATOR_HOST=localhost:8085
```

The rules files are wide open on purpose — they only ever load in the emulator.
The Functions emulator is not enabled; there is no functions source in this repo yet.

For the full local ingestion path, run the Insights app with
`FIRESTORE_EMULATOR_HOST=localhost:8080` and
`FIREBASE_PROJECT_ID=eve-insights`. The checked-in
`firestore.indexes.json` contains the run-history indexes used by future read
APIs; restart the emulator after changing it.
