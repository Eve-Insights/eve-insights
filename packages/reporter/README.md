# @eve-insights/reporter

Ships [Eve](https://eve.dev) eval telemetry to an [Eve Insights](https://github.com/Eve-Insights/eve-insights) platform instance.

The reporter implements Eve's `EvalReporter` lifecycle and sends a versioned
JSON protocol to the Insights app. Delivery is best-effort: a platform outage
warns but never changes Eve's eval verdict or exit code.

## Installation

```bash
pnpm add -D @eve-insights/reporter
```

`eve` is a peer dependency.

## Intended usage

```ts
// evals/evals.config.ts
import { defineEvalConfig } from "eve/evals";
import { insightsReporter } from "@eve-insights/reporter";

export default defineEvalConfig({
  reporters: [
    insightsReporter({
      url: process.env.EVE_INSIGHTS_URL ?? "http://localhost:3000",
      agentName: "Weather Station Agent",
    }),
  ],
});
```

`EVE_INSIGHTS_URL` is the base URL of the Insights app. The reporter registers
the run, then sends `run.started`, `eval.started`, `session.started`,
`eval.completed`, and `run.completed` events. Callback payloads are serialized
to JSON-safe values, gzip-compressed, checksummed, and uploaded in bounded
chunks so large event streams and tool results do not have to fit in one
Firestore document.

The reporter does not send executable eval functions or target handle methods.
It sends their useful metadata and preserves the complete serializable callback
data in the event payload.

`agentName` is required. The reporter derives a deterministic UUID agent ID
from it and sends both values to the dashboard.

Additional settings:

```ts
insightsReporter({
  url: "http://localhost:3000",
  agentName: "Weather Station Agent",
  retries: 2,
  retryDelayMs: 250,
  timeoutMs: 10_000,
  chunkSizeBytes: 128 * 1024,
});
```

The platform currently exposes unauthenticated ingestion for local
development. Add network controls or authentication before sending sensitive
evaluation data to a public deployment.

## License

MIT © Jim Drury
