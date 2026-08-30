import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

/**
 * Sessions the eval did not create.
 *
 * `dispatchSchedule` triggers an authored schedule through the dev-only route
 * and returns the session ids it started; `attachSession` then consumes one
 * turn from that session so its events feed the run-level assertions.
 *
 * Dev routes only exist on a local target, so this eval skips itself rather
 * than failing when run against a deployment with `--url`.
 */
export default defineEval({
  description:
    "A schedule is dispatched and its session is attached and asserted on.",
  tags: ["deterministic"],
  async test(t) {
    if (!t.target.capabilities.devRoutes) {
      t.skip("dispatchSchedule needs a target with dev routes enabled");
    }

    const { scheduleId, sessionIds } =
      await t.target.dispatchSchedule("heartbeat");
    t.log(`dispatched ${scheduleId} -> ${sessionIds.join(", ")}`);

    const [sessionId] = await t.require(
      sessionIds,
      satisfies(
        (ids: readonly string[]) => ids.length > 0,
        "dispatch started a session",
      ),
    );

    const session = await t.target.attachSession(sessionId);

    session.succeeded();
    session.calledTool("get_forecast", { input: { city: "Brooklyn" } });
    t.calledTool("get_forecast");
  },
});
