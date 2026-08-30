import { insightsReporter } from "@eve-insights/reporter";
import { defineEvalConfig } from "eve/evals";

/**
 * Exactly one config is required at the root of `evals/`.
 *
 * `judge` is the default model for every `t.judge.*` assertion. It is only ever
 * used for scoring and never replaces the agent under test. A string id routes
 * through the Vercel AI Gateway, so it needs `AI_GATEWAY_API_KEY` or
 * `VERCEL_OIDC_TOKEN` in the environment; without credentials judge-backed
 * evals skip visibly rather than failing.
 *
 * The Insights reporter is opt-in: set `EVE_INSIGHTS_URL` to register it.
 */
const insightsUrl = process.env.EVE_INSIGHTS_URL;

export default defineEvalConfig({
  judge: { model: "minimax/minimax-m3" },
  maxConcurrency: 4,
  timeoutMs: 120_000,
  reporters:
    insightsUrl === undefined || insightsUrl.length === 0
      ? []
      : [
          insightsReporter({
            url: insightsUrl,
            agentName:
              process.env.EVE_INSIGHTS_AGENT_NAME ?? "Weather Station Agent",
          }),
        ],
});
