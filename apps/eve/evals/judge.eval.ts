import { defineEval } from "eve/evals";

/**
 * Every LLM-as-judge grader.
 *
 * Judges are soft by default. With no threshold they are tracked-only and never
 * fail, even under `--strict`; `.atLeast(n)` sets a soft bar; `.gate(n)` makes
 * one fatal. The judge model is resolved separately from the agent under test
 * and never replaces it — the per-eval `judge` below overrides
 * `evals.config.ts` for this file, and one call overrides it again per-call.
 *
 * Thresholds are set against the graders' real semantics, not wishful ones.
 * `factuality` returns autoevals' A-E buckets: a *subset* of the expected answer
 * scores 0.4, a superset 0.6, and an exact match 1.0. A deliberately terse agent
 * lands in the subset bucket, so 0.4 is the honest bar for "said nothing wrong".
 */
export default defineEval({
  description:
    "All four autoevals graders, across reply, draft and transcript.",
  tags: ["judge"],
  judge: { model: "anthropic/claude-haiku-4.5" },
  async test(t) {
    const first = await t.send("What is the forecast for Brooklyn?");
    t.succeeded();

    // Grades `t.reply` by default.
    t.judge.autoevals
      .factuality("Brooklyn is sunny and 72 degrees Fahrenheit.")
      .label("forecast is factual")
      .atLeast(0.4);

    t.judge.autoevals
      .closedQA("states both a condition and a temperature")
      .atLeast(0.5);

    // Tracked-only: no threshold, so it lands in reports and never fails.
    t.judge.autoevals.closedQA("is two sentences or fewer").label("brevity");

    // A per-call model override, cheaper or stronger than the eval's judge.
    t.judge.autoevals
      .sql(
        "SELECT condition, temperature_f FROM forecasts WHERE city = 'Brooklyn'",
        {
          on: "SELECT condition, temperature_f FROM forecasts WHERE city = 'Brooklyn';",
          model: "anthropic/claude-haiku-4.5",
        },
      )
      .label("sql equivalence")
      .atLeast(0.5);

    // `on` grades an explicit value rather than the final reply.
    t.judge.autoevals
      .closedQA("names Brooklyn", { on: first.message })
      .label("first turn names the city")
      .atLeast(0.5);

    await t.send("And Reykjavik?");

    // `t.transcript` grades the whole conversation instead of the last reply.
    t.judge.autoevals
      .summarizes(
        "The user asked for the Brooklyn and Reykjavik forecasts. The assistant reported " +
          "Brooklyn as sunny at 72F and Reykjavik as snowing at 28F.",
        { on: t.transcript },
      )
      .label("transcript summary")
      .atLeast(0.4);

    t.judge.autoevals
      .closedQA(
        "The assistant gave a forecast for both Brooklyn and Reykjavik",
        {
          on: t.transcript,
        },
      )
      .label("multi-turn coverage")
      .atLeast(0.5);
  },
});
