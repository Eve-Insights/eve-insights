import { createHash } from "node:crypto";
import {
  type AdapterCommitResult,
  type AdapterWriteResult,
  type BeginEventInput,
  type CommitEventInput,
  DatabaseAdapterError,
  type EventProjection,
  type JsonObject,
  type WriteEventChunkInput,
} from "@eve-insights/adapter-types";
import { validatedCounts } from "./records.js";
import type { AdapterContext, StoreRecord } from "./types.js";
import {
  asRecord,
  compareEvent,
  decodeChunk,
  requireEvaluationId,
  requireId,
  requireIsoDate,
  validatePayloadManifest,
} from "./validate.js";

function eventRecord(input: BeginEventInput): StoreRecord {
  return {
    runId: input.runId,
    eventId: input.eventId,
    sequence: input.sequence,
    type: input.type,
    occurredAt: input.occurredAt,
    projection: input.projection as unknown as JsonObject,
    payload: input.payload as unknown as JsonObject,
    status: "staged",
  };
}

export async function beginEvent(
  context: AdapterContext,
  input: BeginEventInput,
): Promise<AdapterWriteResult> {
  requireId(input.runId, "runId");
  requireId(input.eventId, "eventId");
  if (!Number.isInteger(input.sequence) || input.sequence < 0) {
    throw new DatabaseAdapterError(
      "invalid",
      "Event sequence must be non-negative.",
    );
  }
  requireIsoDate(input.occurredAt, "occurredAt");
  validatePayloadManifest(input.payload, context.maxChunkBytes);

  const run = await context.store.getRun(input.runId);
  if (run === undefined) {
    throw new DatabaseAdapterError(
      "not-found",
      `Run ${input.runId} was not found.`,
    );
  }

  const existing = await context.store.getEvent(input.runId, input.eventId);
  if (existing !== undefined) {
    if (!compareEvent(existing, input)) {
      throw new DatabaseAdapterError(
        "conflict",
        `Event ${input.eventId} already exists with different metadata.`,
      );
    }
    return { created: false };
  }

  try {
    await context.store.insertEvent(eventRecord(input));
    return { created: true };
  } catch (error) {
    const latest = await context.store.getEvent(input.runId, input.eventId);
    if (latest === undefined) throw error;
    if (!compareEvent(latest, input)) {
      throw new DatabaseAdapterError(
        "conflict",
        `Event ${input.eventId} already exists with different metadata.`,
      );
    }
    return { created: false };
  }
}

export async function writeEventChunk(
  context: AdapterContext,
  input: WriteEventChunkInput,
): Promise<AdapterWriteResult> {
  requireId(input.runId, "runId");
  requireId(input.eventId, "eventId");
  if (!Number.isInteger(input.index) || input.index < 0) {
    throw new DatabaseAdapterError(
      "invalid",
      "Chunk index must be non-negative.",
    );
  }

  const event = await context.store.getEvent(input.runId, input.eventId);
  if (event === undefined) {
    throw new DatabaseAdapterError(
      "not-found",
      `Event ${input.eventId} was not found.`,
    );
  }
  const manifest = asRecord(event.payload);
  if (
    input.index >= Number(manifest.chunkCount) ||
    !Number.isInteger(Number(manifest.chunkCount))
  ) {
    throw new DatabaseAdapterError(
      "invalid",
      "Chunk index is outside the manifest.",
    );
  }
  const decoded = decodeChunk(input.data, context.maxChunkBytes);
  if (decoded.length > Number(manifest.chunkSize)) {
    throw new DatabaseAdapterError(
      "too-large",
      "Event chunk exceeds the chunk size declared in the manifest.",
    );
  }
  if (input.index < Number(manifest.chunkCount) - 1 && decoded.length === 0) {
    throw new DatabaseAdapterError(
      "invalid",
      "Only the final chunk may be empty.",
    );
  }

  const existing = await context.store.getChunk(
    input.runId,
    input.eventId,
    input.index,
  );
  if (existing !== undefined) {
    if (existing.data !== input.data) {
      throw new DatabaseAdapterError(
        "conflict",
        `Chunk ${input.index} already exists with different data.`,
      );
    }
    return { created: false };
  }

  const chunk = {
    runId: input.runId,
    eventId: input.eventId,
    index: input.index,
    data: input.data,
    byteLength: decoded.length,
  };
  try {
    await context.store.insertChunk(chunk);
    return { created: true };
  } catch (error) {
    const latest = await context.store.getChunk(
      input.runId,
      input.eventId,
      input.index,
    );
    if (latest === undefined) throw error;
    if (latest.data !== input.data) {
      throw new DatabaseAdapterError(
        "conflict",
        `Chunk ${input.index} already exists with different data.`,
      );
    }
    return { created: false };
  }
}

export async function commitEvent(
  context: AdapterContext,
  input: CommitEventInput,
): Promise<AdapterCommitResult> {
  requireId(input.runId, "runId");
  requireId(input.eventId, "eventId");

  const event = await context.store.getEvent(input.runId, input.eventId);
  if (event === undefined) {
    throw new DatabaseAdapterError(
      "not-found",
      `Event ${input.eventId} was not found.`,
    );
  }
  if (event.status === "committed") return { committed: false };

  const manifest = asRecord(event.payload);
  const chunkCount = Number(manifest.chunkCount);
  const chunks = [
    ...(await context.store.listChunks(input.runId, input.eventId)),
  ].sort((left, right) => Number(left.index) - Number(right.index));
  if (
    !Number.isInteger(chunkCount) ||
    chunks.length !== chunkCount ||
    chunks.some((chunk, index) => Number(chunk.index) !== index)
  ) {
    throw new DatabaseAdapterError(
      "incomplete",
      `Event ${input.eventId} is missing one or more chunks.`,
    );
  }

  const buffers = chunks.map((chunk) =>
    decodeChunk(String(chunk.data), context.maxChunkBytes),
  );
  const payload = Buffer.concat(buffers);
  const expectedLength = Number(manifest.byteLength);
  const expectedHash = String(manifest.sha256);
  if (
    payload.length !== expectedLength ||
    createHash("sha256").update(payload).digest("hex") !== expectedHash
  ) {
    throw new DatabaseAdapterError(
      "conflict",
      `Event ${input.eventId} failed payload checksum validation.`,
    );
  }

  const projection = asRecord(event.projection) as unknown as EventProjection;
  const committedAt = new Date().toISOString();

  const committed = await context.store.transaction(async (transaction) => {
    const freshEvent = await transaction.getEvent(input.runId, input.eventId);
    if (freshEvent === undefined) {
      throw new DatabaseAdapterError(
        "not-found",
        `Event ${input.eventId} was not found.`,
      );
    }
    if (freshEvent.status === "committed") return false;

    const run = await transaction.getRun(input.runId);
    if (run === undefined) {
      throw new DatabaseAdapterError(
        "not-found",
        `Run ${input.runId} was not found.`,
      );
    }

    const didCommit = await transaction.markEventCommitted(
      input.runId,
      input.eventId,
      committedAt,
    );
    if (!didCommit) return false;

    const lastSequence = Number(run.lastEventSequence ?? -1);
    const eventSequence = Number(event.sequence);
    const applyProjection = eventSequence > lastSequence;
    const runProjection = projection.run;
    const runUpdate: StoreRecord = {
      lastEventSequence: Math.max(lastSequence, eventSequence),
    };
    if (applyProjection && runProjection?.status !== undefined) {
      runUpdate.status = runProjection.status;
    }
    if (applyProjection && runProjection?.completedAt !== undefined) {
      runUpdate.completedAt = runProjection.completedAt;
    }
    if (applyProjection && runProjection?.counts !== undefined) {
      runUpdate.counts = validatedCounts(
        runProjection.counts,
      ) as unknown as JsonObject;
    }
    await transaction.updateRun(input.runId, runUpdate);

    const evaluation = applyProjection ? projection.evaluation : undefined;
    if (evaluation !== undefined) {
      requireEvaluationId(evaluation.id, "evaluation.id");
      const evaluationPatch: StoreRecord = {
        id: evaluation.id,
        status: evaluation.status,
        ...(evaluation.startedAt === undefined
          ? {}
          : { startedAt: evaluation.startedAt }),
        ...(evaluation.completedAt === undefined
          ? {}
          : { completedAt: evaluation.completedAt }),
        ...(evaluation.verdict === undefined
          ? {}
          : { verdict: evaluation.verdict }),
        ...(evaluation.error === undefined ? {} : { error: evaluation.error }),
        ...(evaluation.skipReason === undefined
          ? {}
          : { skipReason: evaluation.skipReason }),
        ...(evaluation.assertionCount === undefined
          ? {}
          : { assertionCount: evaluation.assertionCount }),
        ...(evaluation.passedAssertionCount === undefined
          ? {}
          : { passedAssertionCount: evaluation.passedAssertionCount }),
        ...(evaluation.failedAssertionCount === undefined
          ? {}
          : { failedAssertionCount: evaluation.failedAssertionCount }),
      };
      const existingEvaluation = await transaction.getEvaluation(
        input.runId,
        evaluation.id,
      );
      if (existingEvaluation === undefined) {
        await transaction.insertEvaluation({
          runId: input.runId,
          ...evaluationPatch,
        });
      } else {
        await transaction.updateEvaluation(
          input.runId,
          evaluation.id,
          evaluationPatch,
        );
      }
    }

    const session = applyProjection ? projection.session : undefined;
    if (session !== undefined) {
      requireEvaluationId(session.evaluationId, "session.evaluationId");
      requireId(session.sessionId, "session.sessionId");
      await transaction.upsertSession({
        runId: input.runId,
        evaluationId: session.evaluationId,
        sessionId: session.sessionId,
        primary: session.primary,
        startedAt: session.startedAt,
        ...(session.traceContext === undefined
          ? {}
          : { traceContext: session.traceContext }),
      });
    }
    return true;
  });

  return { committed };
}
