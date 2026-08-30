import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

/**
 * The human-in-the-loop path, driven by `record_reading`'s `approval: always()`.
 *
 * This eval is also the clearest illustration of assertion scope. A turn is an
 * immutable snapshot, so `parked.parked()` grades the moment the run stopped
 * for a human. Assertions on `t` read the *whole run after `test` finishes*, by
 * which point the approval has been answered and the tool has completed — so
 * the same call is `pending` on the turn and `completed` on the run.
 *
 * Covers `requireInputRequest` with every filter key (`toolName`, `display`,
 * `optionIds`, `prompt`) and `respond` with an explicit request id.
 */
export default defineEval({
  description:
    "An approval-gated tool parks the run, then completes once approved.",
  tags: ["deterministic"],
  async test(t) {
    const parked = await t.send(
      "Record a reading of 71 degrees for station alpha.",
    );

    // Turn-scoped: the state at the moment the turn settled.
    parked.parked();
    parked.calledTool("record_reading", { status: "pending", count: 1 });

    // Records a gate, requires exactly one match, and returns it.
    const request = t.requireInputRequest({
      toolName: "record_reading",
      display: "confirmation",
      optionIds: ["approve", "cancel"],
      prompt: /record_reading/,
    });

    t.log(
      `approving ${request.action.toolName} (request ${request.requestId})`,
    );
    t.check(request.kind, includes("tool-approval"));

    const resumed = await t.respond([
      { requestId: request.requestId, optionId: "approve" },
    ]);

    // Run-scoped: the whole run, after the approval was answered.
    resumed.succeeded();
    t.calledTool("record_reading", {
      input: { station: "alpha" },
      output: { recorded: true },
      status: "completed",
      count: 1,
    });
    t.succeeded();
  },
});
