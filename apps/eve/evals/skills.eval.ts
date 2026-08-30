import { defineEval } from "eve/evals";

/**
 * Skill loading.
 *
 * `t.loadedSkill(name)` is sugar for `calledTool("load_skill", { input: { skill } })`.
 * Whether the model chooses to load a skill is a model decision, so this eval
 * carries the `model-dependent` tag and can be excluded for a stable core run.
 */
export default defineEval({
  description: "A briefing request loads the station-brief skill.",
  tags: ["model-dependent"],
  async test(t) {
    await t.send("Give me a station briefing for Brooklyn.");

    t.succeeded();
    t.loadedSkill("station-brief", { count: (loads) => loads >= 1 });
    t.calledTool("get_forecast");
  },
});
