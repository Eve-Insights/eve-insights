import {
  type AdapterWriteResult,
  type CreateRunInput,
  DatabaseAdapterError,
  type JsonObject,
} from "@eve-insights/adapter-types";
import { MAX_RUN_EVALUATIONS } from "./constants.js";
import { emptyCounts } from "./records.js";
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

  try {
    return await context.store.transaction(async (transaction) => {
      const existing = await transaction.getRun(input.runId);
      if (existing !== undefined) {
        if (
          existing.startedAt !== input.startedAt ||
          existing.agentId !== input.target.agentId ||
          existing.url !== input.target.url ||
          existing.kind !== input.target.kind ||
          existing.name !== input.target.name
        ) {
          throw new DatabaseAdapterError(
            "conflict",
            `Run ${input.runId} is already registered with different metadata.`,
          );
        }
        await seedMissingEvaluations(transaction, input);
        return { created: false };
      }

      await transaction.insertRun({
        runId: input.runId,
        startedAt: input.startedAt,
        agentId: input.target.agentId,
        kind: input.target.kind,
        url: input.target.url,
        name: input.target.name,
        capabilities: input.target.capabilities as unknown as JsonObject,
        status: "running",
        evaluationCount: input.evaluations.length,
        counts: emptyCounts(input.evaluations.length) as unknown as JsonObject,
        lastEventSequence: -1,
      });

      for (const evaluation of input.evaluations) {
        await transaction.insertEvaluation({
          runId: input.runId,
          id: evaluation.id,
          status: "pending",
          ...(evaluation.description === undefined
            ? {}
            : { description: evaluation.description }),
          ...(evaluation.tags === undefined ? {} : { tags: evaluation.tags }),
          ...(evaluation.timeoutMs === undefined
            ? {}
            : { timeoutMs: evaluation.timeoutMs }),
        });
      }

      return { created: true };
    });
  } catch (error) {
    const existing = await context.store.getRun(input.runId);
    if (existing === undefined) throw error;
    if (
      existing.startedAt !== input.startedAt ||
      existing.agentId !== input.target.agentId ||
      existing.url !== input.target.url ||
      existing.kind !== input.target.kind ||
      existing.name !== input.target.name
    ) {
      throw new DatabaseAdapterError(
        "conflict",
        `Run ${input.runId} is already registered with different metadata.`,
      );
    }
    await seedMissingEvaluations(context.store, input);
    return { created: false };
  }
}

async function seedMissingEvaluations(
  store: AdapterContext["store"],
  input: CreateRunInput,
): Promise<void> {
  for (const evaluation of input.evaluations) {
    const existing = await store.getEvaluation(input.runId, evaluation.id);
    if (existing !== undefined) continue;
    await store.insertEvaluation({
      runId: input.runId,
      id: evaluation.id,
      status: "pending",
      ...(evaluation.description === undefined
        ? {}
        : { description: evaluation.description }),
      ...(evaluation.tags === undefined ? {} : { tags: evaluation.tags }),
      ...(evaluation.timeoutMs === undefined
        ? {}
        : { timeoutMs: evaluation.timeoutMs }),
    });
  }
}
