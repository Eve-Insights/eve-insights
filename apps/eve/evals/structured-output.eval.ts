import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { forecastSchema } from "#evals/shared.ts";

/**
 * Structured output.
 *
 * `outputEquals` and `outputMatches` live on a turn or an independent session,
 * never on `t`, because only there is "the output" unambiguous. The runtime
 * makes the model satisfy the schema before the turn settles, which is what
 * makes an exact `outputEquals` safe against a live model.
 */
export default defineEval({
  description:
    "A turn asked for structured output returns data matching the schema.",
  tags: ["deterministic"],
  async test(t) {
    const turn = await t.send(
      "Look up the forecast for Brooklyn and return it as structured data.",
      {
        outputSchema: forecastSchema,
      },
    );

    turn.expectOk();
    t.succeeded();

    turn.outputMatches(forecastSchema);
    turn.outputEquals({
      city: "Brooklyn",
      condition: "Sunny",
      temperatureF: 72,
    });

    t.check(
      turn.data,
      satisfies(
        (value: unknown) => value !== undefined,
        "the turn carried structured data",
      ),
    );
  },
});
