import { defineTool } from "eve/tools";
import { z } from "zod";

/**
 * Always throws. eve records a failed `action.result` and hands the error to
 * the model, which lets evals assert on `{ status: "failed" }` tool calls.
 */
export default defineTool({
  description: "Calibrate a station's temperature sensor.",
  inputSchema: z.object({ station: z.string().min(1) }),
  execute({ station }): never {
    throw new Error(
      `Sensor on station ${station} is offline; calibration failed.`,
    );
  },
});
