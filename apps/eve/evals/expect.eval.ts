import { defineEval } from "eve/evals";
import {
  equals,
  includes,
  matches,
  satisfies,
  similarity,
} from "eve/evals/expect";
import { BROOKLYN, forecastSchema } from "#evals/shared.ts";

/**
 * Every builder in `eve/evals/expect`, and every severity modifier.
 *
 * `t.check(value, assertion)` grades an explicit value, so the value can be a
 * tool's output, a local you computed, or the model's prose. Exact equality is
 * only used on the tool's fixed output; the prose is graded loosely.
 */
export default defineEval({
  description:
    "Every deterministic value-assertion builder and severity modifier.",
  tags: ["deterministic"],
  async test(t) {
    const turn = await t.send("What is the forecast for Brooklyn?");
    t.succeeded();

    const call = turn.requireToolCall("get_forecast");
    const output = call.output as Record<string, unknown>;

    // --- gates by default ---
    t.check(output, equals({ ...BROOKLYN })).label("forecast payload");
    t.check(output, matches(forecastSchema)).label("forecast shape");
    t.check(t.reply, includes(/sunny/i)).label("mentions the condition");
    t.check(
      output.temperatureF,
      satisfies((value: unknown) => value === 72, "temperature is 72F"),
    );

    // --- soft by default: tracked, and only fatal under --strict ---
    t.check(t.reply, similarity("Brooklyn is Sunny at 72F."))
      .label("wording")
      .atLeast(0.3);

    // --- explicit severity overrides ---
    t.check(t.reply, includes("Brooklyn")).soft(); // track without gating
    t.check(output, matches(forecastSchema)).gate(); // already a gate; stated for clarity
  },
});
