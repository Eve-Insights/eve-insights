import { defineSchedule } from "eve/schedules";

/**
 * Task-mode schedule. `eve dev` never fires it on cadence; evals trigger it
 * with `t.target.dispatchSchedule("heartbeat")`.
 *
 * The prompt deliberately avoids `record_reading`: a task-mode session cannot
 * park for a human, and that tool requires approval.
 */
export default defineSchedule({
  cron: "*/30 * * * *",
  markdown:
    "Get the forecast for Brooklyn and report the condition and temperature.",
});
