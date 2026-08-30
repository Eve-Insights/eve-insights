import {
  DatabaseAdapterError,
  type EvaluationRecord,
  type JsonObject,
  type RunCounts,
  type RunRecord,
} from "@eve-insights/adapter-types";
import {
  asRecord,
  isIsoDate,
  isNonNegativeInteger,
  isRunStatus,
  isTargetKind,
} from "./validate.js";

export function emptyCounts(total: number): RunCounts {
  return {
    total,
    passed: 0,
    failed: 0,
    scored: 0,
    skipped: 0,
    errored: 0,
  };
}

export function validatedCounts(value: unknown): RunCounts {
  const counts = asRecord(value);
  const keys = ["total", "passed", "failed", "scored", "skipped", "errored"];
  if (
    !keys.every(
      (key) =>
        typeof counts[key] === "number" &&
        Number.isInteger(counts[key]) &&
        (counts[key] as number) >= 0,
    )
  ) {
    throw new DatabaseAdapterError("invalid", "Run counts are invalid.");
  }
  return {
    total: counts.total as number,
    passed: counts.passed as number,
    failed: counts.failed as number,
    scored: counts.scored as number,
    skipped: counts.skipped as number,
    errored: counts.errored as number,
  };
}

export function readRunRecord(
  value: Record<string, unknown>,
): RunRecord | undefined {
  const capabilities = asRecord(value.capabilities);
  if (
    typeof value.runId !== "string" ||
    !value.runId ||
    typeof value.agentId !== "string" ||
    !value.agentId ||
    !isTargetKind(value.kind) ||
    typeof value.url !== "string" ||
    !value.url ||
    typeof value.name !== "string" ||
    !value.name ||
    !isIsoDate(value.startedAt) ||
    !isRunStatus(value.status) ||
    !isNonNegativeInteger(value.evaluationCount) ||
    !Number.isInteger(value.lastEventSequence) ||
    (value.lastEventSequence as number) < -1 ||
    typeof capabilities.devRoutes !== "boolean"
  ) {
    return undefined;
  }

  let counts: RunCounts;
  try {
    counts = validatedCounts(value.counts);
  } catch {
    return undefined;
  }

  if (value.completedAt !== undefined && !isIsoDate(value.completedAt)) {
    return undefined;
  }

  return {
    runId: value.runId,
    agentId: value.agentId,
    startedAt: value.startedAt,
    status: value.status,
    name: value.name,
    kind: value.kind,
    url: value.url,
    capabilities: { devRoutes: capabilities.devRoutes },
    evaluationCount: value.evaluationCount,
    counts,
    lastEventSequence: value.lastEventSequence as number,
    ...(value.completedAt === undefined
      ? {}
      : { completedAt: value.completedAt }),
  };
}

export function readRunRow(
  row: Record<string, unknown>,
): RunRecord | undefined {
  return readRunRecord({
    runId: row.run_id,
    agentId: row.agent_id,
    startedAt: row.started_at,
    kind: row.kind,
    url: row.url,
    name: row.name,
    capabilities: row.capabilities,
    status: row.status,
    evaluationCount: row.evaluation_count,
    counts: row.counts,
    lastEventSequence: row.last_event_sequence,
    ...(row.completed_at === null || row.completed_at === undefined
      ? {}
      : { completedAt: row.completed_at }),
  });
}

export function readEvaluationRecord(
  value: Record<string, unknown>,
): EvaluationRecord | undefined {
  if (
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.status !== "string" ||
    !["pending", "running", "completed"].includes(value.status) ||
    (value.description !== undefined &&
      typeof value.description !== "string") ||
    (value.tags !== undefined &&
      (!Array.isArray(value.tags) ||
        value.tags.some((tag) => typeof tag !== "string"))) ||
    (value.timeoutMs !== undefined &&
      (!Number.isInteger(value.timeoutMs) ||
        (value.timeoutMs as number) < 1)) ||
    (value.startedAt !== undefined && !isIsoDate(value.startedAt)) ||
    (value.completedAt !== undefined && !isIsoDate(value.completedAt)) ||
    (value.verdict !== undefined &&
      !["passed", "failed", "scored", "skipped"].includes(
        value.verdict as string,
      )) ||
    (value.error !== undefined && typeof value.error !== "string") ||
    (value.skipReason !== undefined && typeof value.skipReason !== "string") ||
    (value.assertionCount !== undefined &&
      !isNonNegativeInteger(value.assertionCount)) ||
    (value.passedAssertionCount !== undefined &&
      !isNonNegativeInteger(value.passedAssertionCount)) ||
    (value.failedAssertionCount !== undefined &&
      !isNonNegativeInteger(value.failedAssertionCount))
  ) {
    return undefined;
  }

  return {
    id: value.id as string,
    status: value.status as EvaluationRecord["status"],
    ...(value.description === undefined
      ? {}
      : { description: value.description as string }),
    ...(value.tags === undefined ? {} : { tags: value.tags as string[] }),
    ...(value.timeoutMs === undefined
      ? {}
      : { timeoutMs: value.timeoutMs as number }),
    ...(value.startedAt === undefined
      ? {}
      : { startedAt: value.startedAt as string }),
    ...(value.completedAt === undefined
      ? {}
      : { completedAt: value.completedAt as string }),
    ...(value.verdict === undefined
      ? {}
      : { verdict: value.verdict as EvaluationRecord["verdict"] }),
    ...(value.error === undefined ? {} : { error: value.error as string }),
    ...(value.skipReason === undefined
      ? {}
      : { skipReason: value.skipReason as string }),
    ...(value.assertionCount === undefined
      ? {}
      : { assertionCount: value.assertionCount as number }),
    ...(value.passedAssertionCount === undefined
      ? {}
      : { passedAssertionCount: value.passedAssertionCount as number }),
    ...(value.failedAssertionCount === undefined
      ? {}
      : { failedAssertionCount: value.failedAssertionCount as number }),
  };
}

export function readEvaluationRow(
  row: Record<string, unknown>,
): EvaluationRecord | undefined {
  return readEvaluationRecord({
    id: row.evaluation_id,
    status: row.status,
    ...(row.description === null || row.description === undefined
      ? {}
      : { description: row.description }),
    ...(row.tags === null || row.tags === undefined ? {} : { tags: row.tags }),
    ...(row.timeout_ms === null || row.timeout_ms === undefined
      ? {}
      : { timeoutMs: row.timeout_ms }),
    ...(row.started_at === null || row.started_at === undefined
      ? {}
      : { startedAt: row.started_at }),
    ...(row.completed_at === null || row.completed_at === undefined
      ? {}
      : { completedAt: row.completed_at }),
    ...(row.verdict === null || row.verdict === undefined
      ? {}
      : { verdict: row.verdict }),
    ...(row.error === null || row.error === undefined
      ? {}
      : { error: row.error }),
    ...(row.skip_reason === null || row.skip_reason === undefined
      ? {}
      : { skipReason: row.skip_reason }),
    ...(row.assertion_count === null || row.assertion_count === undefined
      ? {}
      : { assertionCount: row.assertion_count }),
    ...(row.passed_assertion_count === null ||
    row.passed_assertion_count === undefined
      ? {}
      : { passedAssertionCount: row.passed_assertion_count }),
    ...(row.failed_assertion_count === null ||
    row.failed_assertion_count === undefined
      ? {}
      : { failedAssertionCount: row.failed_assertion_count }),
  });
}

export function runRowFromInput(input: {
  readonly runId: string;
  readonly startedAt: string;
  readonly target: {
    readonly agentId: string;
    readonly kind: string;
    readonly url: string;
    readonly name: string;
    readonly capabilities: { readonly devRoutes: boolean };
  };
  readonly evaluations: readonly unknown[];
}): Record<string, unknown> {
  return {
    run_id: input.runId,
    agent_id: input.target.agentId,
    started_at: input.startedAt,
    kind: input.target.kind,
    url: input.target.url,
    name: input.target.name,
    capabilities: input.target.capabilities as unknown as JsonObject,
    status: "running",
    evaluation_count: input.evaluations.length,
    counts: emptyCounts(input.evaluations.length),
    last_event_sequence: -1,
  };
}

export function eventFromRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  return {
    runId: row.run_id,
    eventId: row.event_id,
    sequence: row.sequence,
    type: row.type,
    occurredAt: row.occurred_at,
    projection: row.projection,
    payload: row.payload,
    status: row.status,
    committedAt: row.committed_at,
  };
}
