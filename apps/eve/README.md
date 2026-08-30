# @eve-insights/eve

This is an [eve](https://eve.dev) agent bootstrapped with [`eve init`](https://eve.dev/docs/reference/cli#eve-init).

## Getting started

First, run the development server:

```bash
eve dev
```

The development TUI opens an interactive session where you can send messages to your agent.

Start by editing `agent/instructions.md` to define the agent's identity, purpose, tone, and response guidelines. Configure its model and runtime behavior in `agent/agent.ts`.

Add capabilities under `agent/`, including tools, connections, channels, skills, subagents, and schedules. eve reloads your changes as you work.

## The agent

A terse weather-station operator. Every primitive exists to make one eval capability
assertable:

| Primitive | Purpose |
| --- | --- |
| `agent/tools/get_forecast.ts` | Fixed lookup table — the deterministic backbone assertions grade against |
| `agent/tools/list_stations.ts` | A second tool, so `toolOrder` has an order to check |
| `agent/tools/record_reading.ts` | `approval: always()` — parks the run for a human |
| `agent/tools/run_diagnostics.ts` | Slow and abort-aware — cancelled mid-flight |
| `agent/tools/calibrate_sensor.ts` | Always throws — produces a `failed` action |
| `agent/skills/station-brief.md` | Loaded on demand, for `loadedSkill` |
| `agent/subagents/almanac/` | Declared subagent, for `calledSubagent` |
| `agent/schedules/heartbeat.ts` | Dispatched by an eval, for `dispatchSchedule` |

## Evals

```bash
pnpm eval                                # everything
pnpm eval --list                         # discovery only, no model calls
pnpm eval --exclude-tag model-dependent  # the stable core
pnpm eval tools --verbose                # one directory, streaming t.log lines
pnpm eval --strict --junit .eve/junit.xml
```

Evals drive a **live model**, so a full run costs tokens and needs `AI_GATEWAY_API_KEY`
or a valid `VERCEL_OIDC_TOKEN`. Artifacts land in `.eve/evals/<timestamp>/` —
`summary.json`, `results.jsonl`, and per-eval assertion results and event streams.

Tags: `fast`, `deterministic`, `dataset`, `judge`, and `model-dependent` for the evals
that depend on the model *choosing* to load a skill, delegate, or read an attachment.

### Coverage

| Surface | Where |
| --- | --- |
| `succeeded` `messageIncludes` `usedNoTools` `maxToolCalls` `notCalledTool` | `smoke` |
| `calledTool` with `input`/`output`/`status`/`count`, `toolOrder`, `noFailedActions`, `requireToolCall` | `tools/forecast` |
| `status: "failed"`, `notEvent` | `tools/failure` |
| `parked`, `requireInputRequest`, `respond`, `status: "pending"` → `"completed"` | `tools/approval` |
| `respondAll`, `status: "rejected"` | `tools/denial` |
| `includes` `equals` `matches` `similarity` `satisfies`, and `.gate`/`.soft`/`.atLeast`/`.label` | `expect` |
| `outputEquals`, `outputMatches`, `send({ outputSchema })` | `structured-output` |
| `require`, session continuity, `transcript`, `sleep` | `multi-turn` |
| `newSession` and session-scoped assertions | `sessions` |
| `start`, `waitForEvent`, `cancel`, `result`, `eventOrder`, `signal`, `timeoutMs` | `cancellation` |
| `event`, `notEvent`, `eventOrder`, `eventsSatisfy` | `events` |
| `loadedSkill` | `skills` |
| `calledSubagent` | `subagents` |
| `sendFile` | `attachments` |
| `factuality` `summarizes` `closedQA` `sql`, `on`/`model` overrides, per-eval `judge` | `judge` |
| `target.fetch`, `target.kind`/`url`/`capabilities` | `target/health` |
| `dispatchSchedule`, `attachSession`, `skip` | `target/schedule` |
| Array fan-out, `loadYaml`, `loadJson` | `dataset` |

Two eve features are deliberately **not** covered:

- **`mockModel`** is a property of the agent, not of an eval. Using it would make this a
  fixture rather than a working example agent, and no eval could then exercise a real
  model. Assertions are written to tolerate a live model instead — exact equality is only
  ever applied to tool output and schema-constrained structured output, never to prose.
- **Reporters.** Set `EVE_INSIGHTS_URL` to register the Insights reporter from
  `evals/evals.config.ts`. Delivery is best-effort and the endpoint is currently
  unauthenticated. `EVE_INSIGHTS_AGENT_NAME` controls the label shown for this
  agent on the Insights dashboard. `--skip-report` disables it; `--junit`
  remains useful for CI.

## Learn more

To learn more about eve, explore these resources:

- [eve documentation](https://eve.dev/docs) — learn about eve's features and authoring APIs.
- [Build an Agent tutorial](https://eve.dev/docs/tutorial/first-agent) — build and deploy an agent step by step.
- [eve on GitHub](https://github.com/vercel/eve) — view the source and contribute.

## Deploy on Vercel

Deploy your agent to [Vercel](https://vercel.com) from the project root:

```bash
eve deploy
```

`eve deploy` links a Vercel project if needed and deploys the agent to production. See the [eve deployment documentation](https://eve.dev/docs/guides/deployment/vercel) for authentication, environment variables, and deployment options.
