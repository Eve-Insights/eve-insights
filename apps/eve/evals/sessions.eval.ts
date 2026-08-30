import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

/**
 * Independent sessions.
 *
 * `t.newSession()` opens a second session against the same target. It carries
 * the full assertion vocabulary itself, and its events still feed the
 * run-level assertions on `t`.
 */
export default defineEval({
  description:
    "A second, independent session is driven and asserted on separately.",
  tags: ["deterministic"],
  async test(t) {
    await t.send("What is the forecast for Manchester?");

    const other = t.newSession();
    await other.send("What is the forecast for Reykjavik?");

    // Assertions scoped to the independent session.
    other.succeeded();
    other.calledTool("get_forecast", { input: { city: "Reykjavik" } });
    other.messageIncludes(/snow/i);

    // Run-level assertions see both sessions.
    t.calledTool("get_forecast", { count: (calls) => calls >= 2 });
    t.succeeded();

    t.check(
      other.sessionId,
      satisfies(
        (id: unknown) => typeof id === "string" && id !== t.sessionId,
        "the second session has its own id",
      ),
    );
  },
});
