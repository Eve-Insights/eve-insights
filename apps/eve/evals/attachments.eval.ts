import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

/**
 * File attachments.
 *
 * `t.sendFile` attaches a local file as a data URL on a text turn. The path is
 * resolved from the app root. `minimax/minimax-m3` advertises `file-input`, so
 * the note's contents reach the model.
 */
export default defineEval({
  description: "A local file is attached to a turn and read by the agent.",
  tags: ["model-dependent"],
  async test(t) {
    await t.sendFile(
      "What reference code does this shift note mention? Reply with the code only.",
      "evals/data/station-note.txt",
      "text/plain",
    );

    t.succeeded();
    t.check(t.reply, includes("STATION-BRAVO-4417")).label(
      "reads the reference code",
    );
  },
});
