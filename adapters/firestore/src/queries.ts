import type {
  AgentRecord,
  AgentSelector,
  RunRecord,
  RunReport,
} from "@eve-insights/adapter-types";
import { runRef } from "./paths.js";
import { readEvaluationRecord, readRunRecord } from "./records.js";
import type { AdapterContext } from "./types.js";
import { asRecord, requireId } from "./validate.js";

export async function listAgents(
  context: AdapterContext,
): Promise<readonly AgentRecord[]> {
  const snapshot = await context.client.collection("evalRuns").get();
  const agents = new Map<string, AgentRecord>();

  for (const document of snapshot.docs) {
    const data = asRecord(document.data());
    const run = readRunRecord(data);
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
  const snapshot = await context.client.collection("evalRuns").get();
  const runs: RunRecord[] = [];

  for (const document of snapshot.docs) {
    const data = asRecord(document.data());
    const run = readRunRecord(data);
    if (run === undefined || run.agentId !== target.agentId) continue;
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

  const reference = runRef(context.client, runId);
  const snapshot = await reference.get();
  if (!snapshot.exists) return undefined;

  const run = readRunRecord(asRecord(snapshot.data()));
  if (run === undefined || run.agentId !== target.agentId) {
    return undefined;
  }

  const evaluationsSnapshot = await reference.collection("evaluations").get();
  const evaluations = evaluationsSnapshot.docs.flatMap((document) => {
    const evaluation = readEvaluationRecord(asRecord(document.data()));
    return evaluation === undefined ? [] : [evaluation];
  });

  return {
    run,
    evaluations: evaluations.sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
}
