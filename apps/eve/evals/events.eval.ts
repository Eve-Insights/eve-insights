import { defineEval } from "eve/evals";

/**
 * The typed event stream underneath every other assertion.
 *
 * Covers `event` (presence, partial data match, count), `notEvent`,
 * `eventOrder`, and `eventsSatisfy` — the escape hatch for any predicate the
 * matcher language cannot express.
 */
export default defineEval({
  description:
    "Typed stream events are matched by presence, data, count and order.",
  tags: ["deterministic"],
  async test(t) {
    await t.send("What is the forecast for Manchester?");
    t.succeeded();

    t.event("message.completed", { count: (seen) => seen >= 1 });
    t.event("actions.requested");
    t.notEvent("session.failed");

    t.eventOrder([
      { type: "actions.requested" },
      { type: "message.completed" },
    ]);

    t.eventsSatisfy("the run emitted a terminal session event", (events) =>
      events.some(
        (event) =>
          event.type === "session.waiting" ||
          event.type === "session.completed",
      ),
    );

    t.eventsSatisfy(
      "every event carries a type",
      (events) =>
        events.length > 0 &&
        events.every((event) => typeof event.type === "string"),
    );
  },
});
