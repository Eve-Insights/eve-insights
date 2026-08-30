import { defineEval } from "eve/evals";

/**
 * Subagent delegation to the declared `almanac` subagent.
 *
 * Covers `calledSubagent` with the `count` and `status` matchers, plus the
 * `subagent.*` typed events. Delegation is a model decision, so this eval is
 * tagged `model-dependent`.
 */
export default defineEval({
  description:
    "A historical weather question is delegated to the almanac subagent.",
  tags: ["model-dependent"],
  async test(t) {
    await t.send(
      "What was the hottest summer on record in Brooklyn? Ask the almanac.",
    );

    t.succeeded();
    t.calledSubagent("almanac", {
      status: "completed",
      count: (calls) => calls >= 1,
    });
    t.event("subagent.called", { data: { name: "almanac" } });
  },
});
