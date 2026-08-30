import { defineAgent } from "eve";

/**
 * A declared subagent exists so evals can assert on `t.calledSubagent`.
 * `description` is required — the compiler rejects a subagent without one.
 */
export default defineAgent({
  description:
    "Look up historical weather records and long-run averages. Delegate any question about the past to this subagent.",
  model: "minimax/minimax-m3",
});
