import { createHash } from "node:crypto";
import {
  type AdapterCommitResult,
  type AdapterWriteResult,
  type BeginEventInput,
  type CommitEventInput,
  DatabaseAdapterError,
  type EventProjection,
  type WriteEventChunkInput,
} from "@eve-insights/adapter-types";
import { isUniqueViolation, throwUnexpected } from "./errors.js";
import { selectAll } from "./page.js";
import { eventFromRow, validatedCounts } from "./records.js";
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

  const run = await context.client
    .from("eval_runs")
    .select("run_id")
    .eq("run_id", input.runId)
    .maybeSingle();
  if (run.error !== null) {
    throwUnexpected(run.error);
  }
  if (run.data === null) {
    throw new DatabaseAdapterError(
      "not-found",
      `Run ${input.runId} was not found.`,
    );
  }

  const { error } = await context.client.from("events").insert({
    run_id: input.runId,
    event_id: input.eventId,
    sequence: input.sequence,
    type: input.type,
    occurred_at: input.occurredAt,
    projection: input.projection,
    payload: input.payload,
    status: "staged",
  });

  if (error !== null) {
    if (!isUniqueViolation(error)) {
      throwUnexpected(error);
    }

    const existing = await context.client
      .from("events")
      .select("*")
      .eq("run_id", input.runId)
      .eq("event_id", input.eventId)
      .maybeSingle();
    if (existing.error !== null) {
      throwUnexpected(existing.error);
    }
    if (existing.data === null) {
      throw new DatabaseAdapterError(
        "conflict",
        `Event sequence ${input.sequence} is already used.`,
      );
    }
    if (!compareEvent(eventFromRow(asRecord(existing.data)), input)) {
      throw new DatabaseAdapterError(
        "conflict",
        `Event ${input.eventId} already exists with different metadata.`,
      );
    }
    return { created: false };
  }

  return { created: true };
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

  const event = await context.client
    .from("events")
    .select("*")
    .eq("run_id", input.runId)
    .eq("event_id", input.eventId)
    .maybeSingle();
  if (event.error !== null) {
    throwUnexpected(event.error);
  }
  if (event.data === null) {
    throw new DatabaseAdapterError(
      "not-found",
      `Event ${input.eventId} was not found.`,
    );
  }

  const eventData = asRecord(event.data);
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

  const { error } = await context.client.from("event_chunks").insert({
    run_id: input.runId,
    event_id: input.eventId,
    index: input.index,
    data: input.data,
    byte_length: decoded.length,
  });

  if (error !== null) {
    if (!isUniqueViolation(error)) {
      throwUnexpected(error);
    }

    const existing = await context.client
      .from("event_chunks")
      .select("*")
      .eq("run_id", input.runId)
      .eq("event_id", input.eventId)
      .eq("index", input.index)
      .maybeSingle();
    if (existing.error !== null) {
      throwUnexpected(existing.error);
    }
    if (asRecord(existing.data).data !== input.data) {
      throw new DatabaseAdapterError(
        "conflict",
        `Chunk ${input.index} already exists with different data.`,
      );
    }
    return { created: false };
  }

  return { created: true };
}

export async function commitEvent(
  context: AdapterContext,
  input: CommitEventInput,
): Promise<AdapterCommitResult> {
  requireId(input.runId, "runId");
  requireId(input.eventId, "eventId");

  const event = await context.client
    .from("events")
    .select("*")
    .eq("run_id", input.runId)
    .eq("event_id", input.eventId)
    .maybeSingle();
  if (event.error !== null) {
    throwUnexpected(event.error);
  }
  if (event.data === null) {
    throw new DatabaseAdapterError(
      "not-found",
      `Event ${input.eventId} was not found.`,
    );
  }

  const eventData = asRecord(event.data);
  if (eventData.status === "committed") return { committed: false };

  const manifest = asRecord(eventData.payload);
  const chunkCount = Number(manifest.chunkCount);
  const chunksResult = await selectAll(context, "event_chunks", (query) =>
    query.eq("run_id", input.runId).eq("event_id", input.eventId),
  );

  const chunks = [...chunksResult].sort(
    (left, right) =>
      Number(asRecord(left).index) - Number(asRecord(right).index),
  );
  if (
    chunks.length !== chunkCount ||
    chunks.some((chunk, index) => Number(asRecord(chunk).index) !== index)
  ) {
    throw new DatabaseAdapterError(
      "incomplete",
      `Event ${input.eventId} is missing one or more chunks.`,
    );
  }

  const buffers = chunks.map((chunk) =>
    decodeChunk(String(asRecord(chunk).data), context.maxChunkBytes),
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
  const cas = await context.client
    .from("events")
    .update({ status: "committed", committed_at: committedAt })
    .eq("run_id", input.runId)
    .eq("event_id", input.eventId)
    .eq("status", "staged")
    .select("event_id");
  if (cas.error !== null) {
    throwUnexpected(cas.error);
  }
  if ((cas.data ?? []).length === 0) {
    return { committed: false };
  }

  const run = await context.client
    .from("eval_runs")
    .select("*")
    .eq("run_id", input.runId)
    .maybeSingle();
  if (run.error !== null) {
    throwUnexpected(run.error);
  }
  if (run.data === null) {
    throw new DatabaseAdapterError(
      "not-found",
      `Run ${input.runId} was not found.`,
    );
  }

  const runData = asRecord(run.data);
  const lastSequence = Number(runData.last_event_sequence ?? -1);
  const eventSequence = Number(eventData.sequence);
  const applyProjection = eventSequence > lastSequence;
  const runProjection = projection.run;
  const runUpdate: Record<string, unknown> = {
    last_event_sequence: Math.max(lastSequence, eventSequence),
  };
  if (applyProjection && runProjection?.status !== undefined) {
    runUpdate.status = runProjection.status;
  }
  if (applyProjection && runProjection?.completedAt !== undefined) {
    runUpdate.completed_at = runProjection.completedAt;
  }
  if (applyProjection && runProjection?.counts !== undefined) {
    runUpdate.counts = validatedCounts(runProjection.counts);
  }

  const evaluation = applyProjection ? projection.evaluation : undefined;
  if (evaluation !== undefined) {
    requireEvaluationId(evaluation.id, "evaluation.id");
    const { error: evaluationError } = await context.client
      .from("evaluations")
      .upsert(
        {
          run_id: input.runId,
          evaluation_id: evaluation.id,
          status: evaluation.status,
          ...(evaluation.startedAt === undefined
            ? {}
            : { started_at: evaluation.startedAt }),
          ...(evaluation.completedAt === undefined
            ? {}
            : { completed_at: evaluation.completedAt }),
          ...(evaluation.verdict === undefined
            ? {}
            : { verdict: evaluation.verdict }),
          ...(evaluation.error === undefined
            ? {}
            : { error: evaluation.error }),
          ...(evaluation.skipReason === undefined
            ? {}
            : { skip_reason: evaluation.skipReason }),
          ...(evaluation.assertionCount === undefined
            ? {}
            : { assertion_count: evaluation.assertionCount }),
          ...(evaluation.passedAssertionCount === undefined
            ? {}
            : { passed_assertion_count: evaluation.passedAssertionCount }),
          ...(evaluation.failedAssertionCount === undefined
            ? {}
            : { failed_assertion_count: evaluation.failedAssertionCount }),
        },
        { onConflict: "run_id,evaluation_id" },
      );
    if (evaluationError !== null) {
      throwUnexpected(evaluationError);
    }
  }

  const session = applyProjection ? projection.session : undefined;
  if (session !== undefined) {
    requireEvaluationId(session.evaluationId, "session.evaluationId");
    requireId(session.sessionId, "session.sessionId");
    const { error: sessionError } = await context.client
      .from("sessions")
      .upsert(
        {
          run_id: input.runId,
          session_id: session.sessionId,
          evaluation_id: session.evaluationId,
          is_primary: session.primary,
          started_at: session.startedAt,
          ...(session.traceContext === undefined
            ? {}
            : { trace_context: session.traceContext }),
        },
        { onConflict: "run_id,session_id" },
      );
    if (sessionError !== null) {
      throwUnexpected(sessionError);
    }
  }

  const { error: runError } = await context.client
    .from("eval_runs")
    .update(runUpdate)
    .eq("run_id", input.runId);
  if (runError !== null) {
    throwUnexpected(runError);
  }

  return { committed: true };
}
