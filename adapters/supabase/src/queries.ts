import type {
  AgentRecord,
  AgentSelector,
  RunRecord,
  RunReport,
} from "@eve-insights/adapter-types";
import { throwUnexpected } from "./errors.js";
import { selectAll } from "./page.js";
import { readEvaluationRow, readRunRow } from "./records.js";
import type { AdapterContext } from "./types.js";
import { asRecord, requireId } from "./validate.js";

export async function listAgents(
  context: AdapterContext,
): Promise<readonly AgentRecord[]> {
  const data = await selectAll(context, "eval_runs");

  const agents = new Map<string, AgentRecord>();

  for (const row of data) {
    const run = readRunRow(asRecord(row));
    if (run === undefined) continue;

    const key = run.agentId;
    const current = agents.get(key);
    if (current === undefined || run.startedAt > current.lastRunStartedAt) {
      agents.set(key, {
        agentId: key,
        kind: run.kind,
        url: run.url,
        name: run.name,
        capabilities: run.capabilities,
        runCount: (current?.runCount ?? 0) + 1,
        evaluationCount: (current?.evaluationCount ?? 0) + run.evaluationCount,
        lastRunStartedAt: run.startedAt,
        lastRunStatus: run.status,
      });
    } else {
      agents.set(key, {
        ...current,
        runCount: current.runCount + 1,
        evaluationCount: current.evaluationCount + run.evaluationCount,
      });
    }
  }

  return [...agents.values()].sort((left, right) => {
    const byDate = right.lastRunStartedAt.localeCompare(left.lastRunStartedAt);
    return byDate !== 0 ? byDate : left.url.localeCompare(right.url);
  });
}

export async function listRuns(
  context: AdapterContext,
  target: AgentSelector,
): Promise<readonly RunRecord[]> {
  const data = await selectAll(context, "eval_runs", (query) =>
    query.eq("agent_id", target.agentId),
  );

  const runs: RunRecord[] = [];
  for (const row of data) {
    const run = readRunRow(asRecord(row));
    if (run === undefined) continue;
    runs.push(run);
  }

  return runs.sort((left, right) => {
    const byDate = Date.parse(right.startedAt) - Date.parse(left.startedAt);
    return byDate !== 0 ? byDate : left.runId.localeCompare(right.runId);
  });
}

export async function getRunReport(
  context: AdapterContext,
  target: AgentSelector,
  runId: string,
): Promise<RunReport | undefined> {
  requireId(runId, "runId");

  const runResult = await context.client
    .from("eval_runs")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();
  if (runResult.error !== null) {
    throwUnexpected(runResult.error);
  }
  if (runResult.data === null) return undefined;

  const run = readRunRow(asRecord(runResult.data));
  if (run === undefined || run.agentId !== target.agentId) {
    return undefined;
  }

  const evaluationRows = await selectAll(context, "evaluations", (query) =>
    query.eq("run_id", runId),
  );

  const evaluations = evaluationRows.flatMap((row) => {
    const evaluation = readEvaluationRow(asRecord(row));
    return evaluation === undefined ? [] : [evaluation];
  });

  return {
    run,
    evaluations: evaluations.sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
}
