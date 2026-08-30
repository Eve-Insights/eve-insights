import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

/**
 * Gated on human approval so evals can exercise the HITL park/resume path:
 * the turn stops at `session.waiting`, `t.requireInputRequest()` finds the
 * pending request, and `t.respondAll(...)` resumes it.
 */
export default defineTool({
  description:
    "Record a temperature reading for a station. Requires human approval.",
  inputSchema: z.object({
    station: z.string().min(1),
    temperatureF: z.number(),
  }),
  outputSchema: z.object({ recorded: z.boolean(), station: z.string() }),
  approval: always(),
  execute({ station }) {
    return { recorded: true, station };
  },
});
