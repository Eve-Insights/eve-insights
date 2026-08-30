import { defineEval } from "eve/evals";
import { equals, satisfies } from "eve/evals/expect";
import { loadJson, loadYaml } from "eve/evals/loaders";

/**
 * Dataset fan-out.
 *
 * A file that default-exports an array becomes one eval per entry, with ids
 * derived from the file name plus a zero-padded index: `dataset/0000`,
 * `dataset/0001`, `dataset/0002`. Eval modules are ESM, so top-level `await`
 * can load the fixture.
 *
 * Loader paths resolve from the app root, not from this file.
 */
const doc = await loadYaml("evals/data/cities.yaml");
const thresholds = (await loadJson("evals/data/thresholds.json")) as {
  maxToolCallsPerForecast: number;
};

const rows = doc.evals as readonly {
  task: string;
  city: string;
  condition: string;
  temperatureF: number;
}[];

export default rows.map((row) =>
  defineEval({
    description: row.task,
    tags: ["deterministic", "dataset"],
    async test(t) {
      const turn = await t.send(`What is the forecast for ${row.city}?`);

      t.succeeded();
      t.noFailedActions();
      t.maxToolCalls(thresholds.maxToolCallsPerForecast);

      const call = turn.requireToolCall("get_forecast");
      t.check(
        call.output,
        equals({
          city: row.city,
          condition: row.condition,
          temperatureF: row.temperatureF,
        }),
      );

      t.check(
        t.reply,
        satisfies(
          (reply: unknown) =>
            typeof reply === "string" &&
            reply.toLowerCase().includes(row.condition.toLowerCase()),
          `reply mentions ${row.condition}`,
        ),
      );
    },
  }),
);
