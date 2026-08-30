import { defineTool } from "eve/tools";
import { z } from "zod";

/**
 * Deliberately slow, so an eval can start the turn with `t.start(...)`, wait
 * for the tool call to be requested, and cancel it mid-flight. It resolves
 * early when the turn is cancelled, so a cancelled run does not idle for the
 * full duration.
 */
export default defineTool({
  description:
    "Run a full diagnostic sweep on a station. Takes about 30 seconds.",
  inputSchema: z.object({ station: z.string().min(1) }),
  outputSchema: z.object({ station: z.string(), healthy: z.boolean() }),
  async execute({ station }, ctx) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 30_000);
      ctx.abortSignal?.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    return { station, healthy: true };
  },
});
