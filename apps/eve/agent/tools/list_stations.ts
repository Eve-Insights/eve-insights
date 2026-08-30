import { defineTool } from "eve/tools";
import { z } from "zod";

/** Fixed roster. Evals assert `toolOrder(["list_stations", "get_forecast"])`. */
const STATIONS = ["alpha", "bravo", "charlie"] as const;

export default defineTool({
  description: "List every weather station this operator is responsible for.",
  inputSchema: z.object({}),
  outputSchema: z.object({ stations: z.array(z.string()) }),
  execute() {
    return { stations: [...STATIONS] };
  },
});
