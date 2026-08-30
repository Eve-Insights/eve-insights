import type {
  AgentRecord,
  AgentSelector,
  RunRecord,
  RunReport,
} from "@eve-insights/adapter-types";
import { readEvaluationRecord, readRunRecord } from "./records.js";
import type { AdapterContext } from "./types.js";
import { asRecord, requireId } from "./validate.js";

export async function listAgents(
  context: AdapterContext,
): Promise<readonly AgentRecord[]> {
  const runs = await context.store.listRuns();
  const agents = new Map<string, AgentRecord>();

  for (const value of runs) {
    const run = readRunRecord(asRecord(value));
    if (run === undefined) continue;

    const current = agents.get(run.agentId);
    if (current === undefined || run.startedAt > current.lastRunStartedAt) {
      agents.set(run.agentId, {
        agentId: run.agentId,
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
      agents.set(run.agentId, {
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
  const values = await context.store.listRuns(target.agentId);
  const runs: RunRecord[] = [];

  for (const value of values) {
    const run = readRunRecord(asRecord(value));
    if (run !== undefined && run.agentId === target.agentId) {
      runs.push(run);
    }
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

  const value = await context.store.getRun(runId);
  if (value === undefined) return undefined;

  const run = readRunRecord(asRecord(value));
  if (run === undefined || run.agentId !== target.agentId) {
    return undefined;
  }

  const evaluations = (await context.store.listEvaluations(runId)).flatMap(
    (evaluationValue) => {
      const evaluation = readEvaluationRecord(asRecord(evaluationValue));
      return evaluation === undefined ? [] : [evaluation];
    },
  );

  return {
    run,
    evaluations: evaluations.sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
}
