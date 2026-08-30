import {
  DatabaseAdapterError,
  type EvaluationRecord,
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
