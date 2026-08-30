import { z } from "zod";

/**
 * Helpers shared across evals. Any file that does not end in `.eval.ts` is a
 * sibling helper, not a discovered eval.
 */

/** Mirrors the fixed table in `agent/tools/get_forecast.ts`. */
export const BROOKLYN = {
  city: "Brooklyn",
  condition: "Sunny",
  temperatureF: 72,
} as const;

/** Mirrors the roster in `agent/tools/list_stations.ts`. */
export const STATIONS = ["alpha", "bravo", "charlie"] as const;

/** The shape `get_forecast` returns, for `matches()` and `outputMatches()`. */
export const forecastSchema = z.object({
  city: z.string(),
  condition: z.string(),
  temperatureF: z.number(),
});

/** The shape `/eve/v1/health` returns, for `matches()` in `target/health`. */
export const healthSchema = z.object({ status: z.string() });
