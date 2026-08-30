# Local databases

Compose stacks for the Insights adapters. SQLite is a file, not a container —
see [`sqlite`](./sqlite).

Start every emulator from this directory:

```bash
docker compose up -d --build
docker compose down
```

`--build` is only required the first time (or after changing the Firebase
image). Each included file still works on its own from its subdirectory.

| Stack | Service names | Ports |
| --- | --- | --- |
| [MySQL](./mysql) | `mysql` | 3306 |
| [Supabase](./supabase) | `db`, `rest`, `gateway` | 54321, 54322 |
| [Firebase](./firebase) | `emulator` | 4000, 8080, … |

A subset is just the service names:

```bash
docker compose up -d mysql
docker compose up -d gateway emulator
```
