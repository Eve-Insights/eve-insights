import { defineEval } from "eve/evals";

/**
 * The other half of the approval path.
 *
 * Covers `respondAll`, which answers every pending request with one option id,
 * and the `rejected` lifecycle status — so between this file,
 * `tools/approval` and `tools/failure` the suite exercises all four of
 * `pending`, `completed`, `failed` and `rejected`.
 */
export default defineEval({
  description: "A denied approval rejects the tool call instead of running it.",
  tags: ["deterministic"],
  async test(t) {
    const parked = await t.send(
      "Record a reading of 71 degrees for station bravo.",
    );

    parked.parked();
    t.requireInputRequest({ toolName: "record_reading" });

    await t.respondAll("cancel");

    t.calledTool("record_reading", { status: "rejected", count: 1 });
    t.notCalledTool("get_forecast");
    t.succeeded();
  },
});
