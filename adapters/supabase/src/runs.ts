import {
  type AdapterWriteResult,
  type CreateRunInput,
  DatabaseAdapterError,
} from "@eve-insights/adapter-types";
import { MAX_RUN_EVALUATIONS } from "./constants.js";
import { isUniqueViolation, throwUnexpected } from "./errors.js";
import { runRowFromInput } from "./records.js";
import type { AdapterContext } from "./types.js";
import {
  requireAgentName,
  requireEvaluationId,
  requireId,
  requireIsoDate,
} from "./validate.js";

export async function createRun(
  context: AdapterContext,
  input: CreateRunInput,
): Promise<AdapterWriteResult> {
  requireId(input.runId, "runId");
  requireIsoDate(input.startedAt, "startedAt");
  requireAgentName(input.target.name);
  if (input.evaluations.length > MAX_RUN_EVALUATIONS) {
    throw new DatabaseAdapterError(
      "too-large",
      `A run cannot contain more than ${MAX_RUN_EVALUATIONS} evaluations.`,
    );
  }
  for (const [index, evaluation] of input.evaluations.entries()) {
    requireEvaluationId(evaluation.id, `evaluations[${index}].id`);
  }

  const { error } = await context.client
    .from("eval_runs")
    .insert(runRowFromInput(input));

  if (error !== null) {
    if (!isUniqueViolation(error)) {
      throwUnexpected(error);
    }

    const existing = await context.client
      .from("eval_runs")
      .select("*")
      .eq("run_id", input.runId)
      .maybeSingle();
    if (existing.error !== null) {
      throwUnexpected(existing.error);
    }
    const data = existing.data ?? {};
    if (
      data.started_at !== input.startedAt ||
      data.agent_id !== input.target.agentId ||
      data.url !== input.target.url ||
      data.kind !== input.target.kind ||
      data.name !== input.target.name
    ) {
      throw new DatabaseAdapterError(
        "conflict",
        `Run ${input.runId} is already registered with different metadata.`,
      );
    }
    await seedMissingEvaluations(context, input);
    return { created: false };
  }

  await seedMissingEvaluations(context, input);
  return { created: true };
}

async function seedMissingEvaluations(
  context: AdapterContext,
  input: CreateRunInput,
): Promise<void> {
  if (input.evaluations.length === 0) return;

  const existing = await context.client
    .from("evaluations")
    .select("evaluation_id")
    .eq("run_id", input.runId);
  if (existing.error !== null) {
    throwUnexpected(existing.error);
  }
  const have = new Set(
    (existing.data ?? []).map((row) =>
      String((row as { evaluation_id?: unknown }).evaluation_id),
    ),
  );
  const missing = input.evaluations.filter(
    (evaluation) => !have.has(evaluation.id),
  );
  if (missing.length === 0) return;

  const { error: evaluationError } = await context.client
    .from("evaluations")
    .insert(
      missing.map((evaluation) => ({
        run_id: input.runId,
        evaluation_id: evaluation.id,
        ...(evaluation.description === undefined
          ? {}
          : { description: evaluation.description }),
        ...(evaluation.tags === undefined
          ? {}
          : { tags: [...evaluation.tags] }),
        ...(evaluation.timeoutMs === undefined
          ? {}
          : { timeout_ms: evaluation.timeoutMs }),
        status: "pending",
      })),
    );
  if (evaluationError !== null) {
    throwUnexpected(evaluationError);
  }
}
