import { defineEval } from "eve/evals";
import { includes, satisfies } from "eve/evals/expect";
import { BROOKLYN } from "#evals/shared.ts";

/**
 * The deterministic backbone of the suite.
 *
 * Covers `calledTool` with every matcher key (`input`, `output`, `status`,
 * `count`), `toolOrder`, `maxToolCalls`, `noFailedActions`,
 * `turn.requireToolCall`, `turn.expectOk`, and the turn's `.toolCalls` /
 * `.status` fields.
 *
 * Exact equality is safe here because it grades the tool's fixed lookup table,
 * never the model's prose.
 */
export default defineEval({
  description:
    "A briefing request lists the stations, then fetches a forecast.",
  tags: ["deterministic"],
  async test(t) {
    const turn = await t.send(
      "List the stations, then give me the forecast for Brooklyn. Do the list first.",
    );

    turn.expectOk();
    t.succeeded();
    t.noFailedActions();

    // Literal matchers deep-match partially; `count` pins the exact number.
    t.calledTool("get_forecast", {
      input: { city: "Brooklyn" },
      output: {
        condition: BROOKLYN.condition,
        temperatureF: BROOKLYN.temperatureF,
      },
      status: "completed",
      count: 1,
    });

    // RegExp and predicate matcher forms.
    t.calledTool("list_stations", { count: (calls) => calls >= 1 });
    t.calledTool("get_forecast", { output: /Sunny/ });
    t.calledTool("get_forecast", {
      output: (value) => typeof value === "object" && value !== null,
    });

    t.toolOrder(["list_stations", "get_forecast"]);
    t.maxToolCalls(6);

    // `requireToolCall` records a gate and returns the call for dependent checks.
    const call = turn.requireToolCall("get_forecast");
    t.check(JSON.stringify(call.output), includes("72"));

    t.check(turn.status, includes(/completed|waiting/));
    t.check(
      turn.toolCalls.length,
      satisfies(
        (count: number) => count >= 2,
        "the turn recorded both tool calls",
      ),
    );
    t.check(t.reply, includes(/sunny/i));
  },
});
