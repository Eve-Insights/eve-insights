import {
  type AdapterWriteResult,
  type CreateRunInput,
  DatabaseAdapterError,
  type JsonObject,
} from "@eve-insights/adapter-types";
import { MAX_RUN_EVALUATIONS } from "./constants.js";
import { commitInBatches, evaluationRef, runRef } from "./paths.js";
import { emptyCounts } from "./records.js";
import type { AdapterContext } from "./types.js";
import {
  asRecord,
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

  const reference = runRef(context.client, input.runId);
  const created = await context.client.runTransaction(async (transaction) => {
    const existing = await transaction.get(reference);
    if (existing.exists) {
      const data = asRecord(existing.data());
      if (
        data.startedAt !== input.startedAt ||
        data.agentId !== input.target.agentId ||
        data.url !== input.target.url ||
        data.kind !== input.target.kind ||
        data.name !== input.target.name
      ) {
        throw new DatabaseAdapterError(
          "conflict",
          `Run ${input.runId} is already registered with different metadata.`,
        );
      }
      return false;
    }

    transaction.set(reference, {
      runId: input.runId,
      agentId: input.target.agentId,
      startedAt: input.startedAt,
      kind: input.target.kind,
      url: input.target.url,
      name: input.target.name,
      capabilities: input.target.capabilities as unknown as JsonObject,
      status: "running",
      evaluationCount: input.evaluations.length,
      counts: emptyCounts(input.evaluations.length) as unknown as JsonObject,
      lastEventSequence: -1,
    });
    return true;
  });

  await seedMissingEvaluations(context, input);
  return { created };
}

async function seedMissingEvaluations(
  context: AdapterContext,
  input: CreateRunInput,
): Promise<void> {
  const writes = [];
  for (const evaluation of input.evaluations) {
    const reference = evaluationRef(context.client, input.runId, evaluation.id);
    const existing = await reference.get();
    if (existing.exists) continue;
    writes.push({
      reference,
      data: {
        id: evaluation.id,
        ...(evaluation.description === undefined
          ? {}
          : { description: evaluation.description }),
        ...(evaluation.tags === undefined
          ? {}
          : { tags: [...evaluation.tags] }),
        ...(evaluation.timeoutMs === undefined
          ? {}
          : { timeoutMs: evaluation.timeoutMs }),
        status: "pending",
      },
    });
  }
  await commitInBatches(context, writes);
}
