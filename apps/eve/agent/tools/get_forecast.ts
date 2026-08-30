import { defineTool } from "eve/tools";
import { z } from "zod";

/**
 * A fixed lookup table rather than a real weather API. Evals assert on this
 * tool's input and output with `equals`, so the values have to be stable.
 */
const FORECASTS: Record<string, { condition: string; temperatureF: number }> = {
  brooklyn: { condition: "Sunny", temperatureF: 72 },
  manchester: { condition: "Raining", temperatureF: 54 },
  reykjavik: { condition: "Snowing", temperatureF: 28 },
};

export default defineTool({
  description:
    "Get the current forecast for a city. The only source of weather data.",
  inputSchema: z.object({ city: z.string().min(1) }),
  outputSchema: z.object({
    city: z.string(),
    condition: z.string(),
    temperatureF: z.number(),
  }),
  execute({ city }) {
    const forecast = FORECASTS[city.trim().toLowerCase()];
    if (!forecast) {
      throw new Error(
        `No station covers ${city}. Known cities: ${Object.keys(FORECASTS).join(", ")}.`,
      );
    }
    return { city, ...forecast };
  },
});
