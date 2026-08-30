import { defineEval } from "eve/evals";
import { equals, includes, satisfies } from "eve/evals/expect";

/**
 * Several turns in one session.
 *
 * Covers `t.require` (a gate that stops the test body when it fails), session
 * continuity across turns, `t.transcript`, and `t.sleep`.
 */
export default defineEval({
  description:
    "Turns share one session, and the agent remembers earlier context.",
  tags: ["deterministic"],
  async test(t) {
    const first = await t.send(
      "The station I care about is bravo. Just acknowledge it.",
    );
    await t.sleep(100);
    const second = await t.send("Which station did I say I care about?");

    // A failed require stops the script rather than cascading failures.
    await t.require(second.sessionId, equals(first.sessionId));

    t.succeeded();
    second.messageIncludes(/bravo/i);

    // `transcript` is the primary session's user and assistant messages only,
    // labelled `User:` / `Assistant:` and separated by blank lines.
    t.check(t.transcript, includes("User:")).label("transcript has user turns");
    t.check(t.transcript, includes("Assistant:")).label(
      "transcript has assistant turns",
    );
    t.check(
      t.transcript,
      satisfies(
        (value: unknown) =>
          typeof value === "string" && value.split("User:").length === 3,
        "the transcript records both user turns",
      ),
    );
    t.log(`transcript length: ${t.transcript.length}`);
  },
});
