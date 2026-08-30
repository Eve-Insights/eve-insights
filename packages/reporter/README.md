# @eve-insights/reporter

Ships [Eve](https://eve.dev) eval telemetry to an [Eve Insights](https://github.com/Eve-Insights/eve-insights) platform instance.

> **Status: scaffold.** This package builds and publishes, but has no
> implementation yet. The API below is the intended shape, not a shipped one.

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
  reporters: [insightsReporter({ url: process.env.EVE_INSIGHTS_URL })],
});
```

## License

MIT © Jim Drury
