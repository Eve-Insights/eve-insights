import { defineEval } from "eve/evals";

/**
 * A tool that throws.
 *
 * Covers the `status: "failed"` lifecycle matcher and `notEvent`. It
 * deliberately does *not* assert `noFailedActions()` — a failed action is the
 * whole point of this eval — and it tracks the reply softly, because how the
 * model words an apology is not something to gate a build on.
 */
export default defineEval({
  description:
    "A failing tool is recorded as failed and reported, not retried forever.",
  tags: ["deterministic"],
  async test(t) {
    await t.send("Calibrate the sensor on station alpha.");

    t.succeeded();
    t.calledTool("calibrate_sensor", {
      status: "failed",
      count: (calls) => calls >= 1,
    });
    t.notEvent("session.failed");

    // Tracked, never fatal: wording is the model's business.
    t.messageIncludes(/fail|offline|error/i).soft();
  },
});
