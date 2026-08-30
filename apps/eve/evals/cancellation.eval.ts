import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

/**
 * An in-flight turn.
 *
 * `t.start()` returns as soon as the server accepts the turn, so the eval can
 * observe and interrupt work that is still running. Covers `waitForEvent`,
 * `cancel`, `result`, `eventOrder`, the live turn's `.sessionId`, the per-eval
 * `timeoutMs` field, and `t.signal`.
 */
export default defineEval({
  description: "A long-running tool call is cancelled mid-flight.",
  tags: ["deterministic"],
  timeoutMs: 90_000,
  async test(t) {
    const live = await t.start("Run a full diagnostic sweep on station alpha.");
    t.log(`started turn on session ${live.sessionId}`);

    t.check(
      t.signal.aborted,
      satisfies(
        (aborted: unknown) => aborted === false,
        "the eval has not timed out",
      ),
    );

    // Wait until the model has actually requested the slow tool.
    await live.waitForEvent("actions.requested", {
      data: {
        actions: (actions: unknown) =>
          Array.isArray(actions) &&
          actions.some(
            (action) =>
              typeof action === "object" &&
              action !== null &&
              (action as { toolName?: string }).toolName === "run_diagnostics",
          ),
      },
    });

    await live.cancel();

    // `result()` settles the stream and records it for run-level assertions.
    const turn = await live.result();
    turn.eventOrder([{ type: "turn.cancelled" }, { type: "session.waiting" }]);
    t.calledTool("run_diagnostics", {
      status: "pending",
      count: (calls) => calls >= 1,
    });
  },
});
