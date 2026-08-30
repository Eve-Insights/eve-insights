import { defineEval } from "eve/evals";

/**
 * The cheapest possible eval: one turn, no tools.
 *
 * Covers `succeeded`, `messageIncludes`, `usedNoTools`, `maxToolCalls` and
 * `notCalledTool`, plus the `tags` and `metadata` definition fields.
 *
 * `usedNoTools()` and `calledTool()` are mutually exclusive within one run, so
 * this eval never asserts a positive tool call.
 */
export default defineEval({
  description: "A greeting is answered directly, with no tool calls at all.",
  tags: ["fast", "deterministic"],
  metadata: { surface: "run-level assertions", cost: "one turn" },
  async test(t) {
    await t.send("Hello!");

    t.succeeded();
    t.usedNoTools();
    t.maxToolCalls(0);
    t.notCalledTool("get_forecast");
    t.messageIncludes(/\w/);
  },
});
