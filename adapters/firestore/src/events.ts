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
import {
  evaluationRef,
  eventRef,
  eventSequenceRef,
  runRef,
  sessionRef,
} from "./paths.js";
import { validatedCounts } from "./records.js";
import type { AdapterContext } from "./types.js";
import {
  asRecord,
  compareEvent,
  decodeChunk,
  requireEvaluationId,
  requireId,
  requireIsoDate,
  validatePayloadManifest,
} from "./validate.js";

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

  const reference = eventRef(context.client, input.runId, input.eventId);
  return context.client.runTransaction(async (transaction) => {
    const run = await transaction.get(runRef(context.client, input.runId));
    if (!run.exists) {
      throw new DatabaseAdapterError(
        "not-found",
        `Run ${input.runId} was not found.`,
      );
    }

    const sequenceReference = eventSequenceRef(
      context.client,
      input.runId,
      input.sequence,
    );
    const sequenceOwner = await transaction.get(sequenceReference);
    if (sequenceOwner.exists) {
      const ownerId = asRecord(sequenceOwner.data()).eventId;
      if (ownerId !== input.eventId) {
        throw new DatabaseAdapterError(
          "conflict",
          `Event sequence ${input.sequence} is already used.`,
        );
      }
    }

    const existing = await transaction.get(reference);
    if (existing.exists) {
      if (!compareEvent(asRecord(existing.data()), input)) {
        throw new DatabaseAdapterError(
          "conflict",
          `Event ${input.eventId} already exists with different metadata.`,
        );
      }
      return { created: false };
    }

    transaction.set(reference, {
      runId: input.runId,
      eventId: input.eventId,
      sequence: input.sequence,
      type: input.type,
      occurredAt: input.occurredAt,
      projection: input.projection as unknown as JsonObject,
      payload: input.payload as unknown as JsonObject,
      status: "staged",
    });
    transaction.set(sequenceReference, { eventId: input.eventId });
    return { created: true };
  });
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

  const reference = eventRef(context.client, input.runId, input.eventId);
  return context.client.runTransaction(async (transaction) => {
    const event = await transaction.get(reference);
    if (!event.exists) {
      throw new DatabaseAdapterError(
        "not-found",
        `Event ${input.eventId} was not found.`,
      );
    }
    const eventData = asRecord(event.data());
    const manifest = asRecord(eventData.payload);
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

    const chunkReference = reference
      .collection("chunks")
      .doc(String(input.index).padStart(8, "0"));
    const existing = await transaction.get(chunkReference);
    if (existing.exists) {
      const existingData = asRecord(existing.data());
      if (existingData.data !== input.data) {
        throw new DatabaseAdapterError(
          "conflict",
          `Chunk ${input.index} already exists with different data.`,
        );
      }
      return { created: false };
    }

    transaction.set(chunkReference, {
      runId: input.runId,
      eventId: input.eventId,
      index: input.index,
      data: input.data,
      byteLength: decoded.length,
    });
    return { created: true };
  });
}

export async function commitEvent(
  context: AdapterContext,
  input: CommitEventInput,
): Promise<AdapterCommitResult> {
  requireId(input.runId, "runId");
  requireId(input.eventId, "eventId");
  const reference = eventRef(context.client, input.runId, input.eventId);
  const event = await reference.get();
  if (!event.exists) {
    throw new DatabaseAdapterError(
      "not-found",
      `Event ${input.eventId} was not found.`,
    );
  }
  const eventData = asRecord(event.data());
  if (eventData.status === "committed") return { committed: false };

  const manifest = asRecord(eventData.payload);
  const chunkCount = Number(manifest.chunkCount);
  const chunksSnapshot = await reference.collection("chunks").get();
  const chunks = [...chunksSnapshot.docs].sort(
    (left, right) =>
      Number(asRecord(left.data()).index) -
      Number(asRecord(right.data()).index),
  );
  if (
    chunks.length !== chunkCount ||
    chunks.some(
      (chunk, index) => Number(asRecord(chunk.data()).index) !== index,
    )
  ) {
    throw new DatabaseAdapterError(
      "incomplete",
      `Event ${input.eventId} is missing one or more chunks.`,
    );
  }

  const buffers = chunks.map((chunk) =>
    decodeChunk(String(asRecord(chunk.data()).data), context.maxChunkBytes),
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

  const projection = asRecord(
    eventData.projection,
  ) as unknown as EventProjection;
  const committedAt = new Date().toISOString();
  const committed = await context.client.runTransaction(async (transaction) => {
    const freshEvent = await transaction.get(reference);
    const run = await transaction.get(runRef(context.client, input.runId));
    if (!run.exists) {
      throw new DatabaseAdapterError(
        "not-found",
        `Run ${input.runId} was not found.`,
      );
    }
    if (
      freshEvent.exists &&
      asRecord(freshEvent.data()).status === "committed"
    ) {
      return false;
    }

    transaction.set(
      reference,
      { status: "committed", committedAt },
      { merge: true },
    );

    const runData = asRecord(run.data());
    const lastSequence = Number(runData.lastEventSequence ?? -1);
    const eventSequence = Number(eventData.sequence);
    const applyProjection = eventSequence > lastSequence;
    const runUpdate: Record<string, unknown> = {
      lastEventSequence: Math.max(lastSequence, eventSequence),
    };
    const runProjection = projection.run;
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
    transaction.set(runRef(context.client, input.runId), runUpdate, {
      merge: true,
    });

    const evaluation = applyProjection ? projection.evaluation : undefined;
    if (evaluation !== undefined) {
      requireEvaluationId(evaluation.id, "evaluation.id");
      transaction.set(
        evaluationRef(context.client, input.runId, evaluation.id),
        {
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
          ...(evaluation.error === undefined
            ? {}
            : { error: evaluation.error }),
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
        },
        { merge: true },
      );
    }

    const session = applyProjection ? projection.session : undefined;
    if (session !== undefined) {
      requireEvaluationId(session.evaluationId, "session.evaluationId");
      requireId(session.sessionId, "session.sessionId");
      transaction.set(
        sessionRef(context.client, input.runId, session.sessionId),
        {
          runId: input.runId,
          evaluationId: session.evaluationId,
          sessionId: session.sessionId,
          primary: session.primary,
          startedAt: session.startedAt,
          ...(session.traceContext === undefined
            ? {}
            : { traceContext: session.traceContext }),
        },
        { merge: true },
      );
    }
    return true;
  });
  return { committed };
}
