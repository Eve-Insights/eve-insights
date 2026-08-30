import { Buffer } from "node:buffer";
import {
  type BeginEventInput,
  type CreateRunInput,
  type DatabaseAdapter,
  DatabaseAdapterError,
  isConsistentPayloadManifest,
  type JsonObject,
  type JsonValue,
  type LifecycleEventType,
  type TargetSnapshot,
  type WriteEventChunkInput,
} from "@eve-insights/adapter-types";
import {
  INSIGHTS_PROTOCOL_VERSION,
  type WireEventBeginRequest,
  type WireEventChunkRequest,
  type WireEventCommitRequest,
  type WireEventType,
  type WireRunCreateRequest,
} from "@eve-insights/reporter/protocol";
import { ZodError } from "zod";

export type DatabaseSource =
  | DatabaseAdapter
  | (() => DatabaseAdapter | Promise<DatabaseAdapter>);

async function resolveDatabase(
  source: DatabaseSource,
): Promise<DatabaseAdapter> {
  return typeof source === "function" ? source() : source;
}

const MAX_REQUEST_BYTES = 512 * 1024;
const MAX_PAYLOAD_BYTES = 64 * 1024 * 1024;
const MAX_CHUNKS = 1024;
const MAX_EVALUATIONS = 10_000;

class IngestRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "IngestRequestError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 32 || value === null) return depth <= 32;
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item, depth + 1));
  }
  if (isRecord(value)) {
    return Object.values(value).every((item) => isJsonValue(item, depth + 1));
  }
  return false;
}

async function readBody(
  request: Request,
  maxBytes = MAX_REQUEST_BYTES,
): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (Number.isFinite(length) && (length < 0 || length > maxBytes)) {
      throw new IngestRequestError(413, "Request body is too large.");
    }
  }

  const reader = request.body?.getReader();
  if (reader === undefined) {
    throw new IngestRequestError(400, "Request body could not be read.");
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new IngestRequestError(413, "Request body is too large.");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof IngestRequestError) throw error;
    throw new IngestRequestError(400, "Request body could not be read.");
  }

  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new IngestRequestError(400, "Request body must be valid JSON.");
  }
}

function requiredString(
  value: unknown,
  field: string,
  options: { readonly maxLength?: number } = {},
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > (options.maxLength ?? 256)
  ) {
    throw new IngestRequestError(400, `${field} must be a non-empty string.`);
  }
  return value;
}

function id(value: unknown, field: string): string {
  const result = requiredString(value, field);
  if (result.includes("/")) {
    throw new IngestRequestError(400, `${field} must not contain '/'.`);
  }
  return result;
}

function isoDate(value: unknown, field: string): string {
  const result = requiredString(value, field, { maxLength: 64 });
  if (Number.isNaN(Date.parse(result))) {
    throw new IngestRequestError(400, `${field} must be an ISO date.`);
  }
  return result;
}

function target(value: unknown): TargetSnapshot {
  if (!isRecord(value)) {
    throw new IngestRequestError(400, "target must be an object.");
  }
  const kind = value.kind;
  if (kind !== "local" && kind !== "remote") {
    throw new IngestRequestError(400, "target.kind must be local or remote.");
  }
  if (
    !isRecord(value.capabilities) ||
    typeof value.capabilities.devRoutes !== "boolean"
  ) {
    throw new IngestRequestError(
      400,
      "target.capabilities.devRoutes must be boolean.",
    );
  }
  return {
    agentId: requiredString(value.agentId, "target.agentId"),
    kind,
    url: requiredString(value.url, "target.url", { maxLength: 2048 }),
    name: requiredString(value.name, "target.name"),
    capabilities: { devRoutes: value.capabilities.devRoutes },
  };
}

function evaluations(value: unknown): CreateRunInput["evaluations"] {
  if (!Array.isArray(value) || value.length > MAX_EVALUATIONS) {
    throw new IngestRequestError(
      400,
      "evaluations must be an array of at most 10,000 items.",
    );
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new IngestRequestError(
        400,
        `evaluations[${index}] must be an object.`,
      );
    }
    const result = {
      id: requiredString(item.id, `evaluations[${index}].id`),
      ...(item.description === undefined
        ? {}
        : {
            description: requiredString(
              item.description,
              `evaluations[${index}].description`,
              {
                maxLength: 10_000,
              },
            ),
          }),
      ...(item.tags === undefined
        ? {}
        : {
            tags: (() => {
              if (
                !Array.isArray(item.tags) ||
                item.tags.some(
                  (tag) => typeof tag !== "string" || tag.length > 256,
                )
              ) {
                throw new IngestRequestError(
                  400,
                  `evaluations[${index}].tags is invalid.`,
                );
              }
              return item.tags as string[];
            })(),
          }),
      ...(item.timeoutMs === undefined
        ? {}
        : {
            timeoutMs: (() => {
              if (
                typeof item.timeoutMs !== "number" ||
                !Number.isInteger(item.timeoutMs) ||
                item.timeoutMs < 1
              ) {
                throw new IngestRequestError(
                  400,
                  `evaluations[${index}].timeoutMs is invalid.`,
                );
              }
              return item.timeoutMs;
            })(),
          }),
    };
    return result;
  });
}

function protocol(value: unknown, action: string): Record<string, unknown> {
  if (
    !isRecord(value) ||
    value.version !== INSIGHTS_PROTOCOL_VERSION ||
    value.action !== action
  ) {
    throw new IngestRequestError(
      400,
      `Request must use protocol version ${INSIGHTS_PROTOCOL_VERSION} and action '${action}'.`,
    );
  }
  return value;
}

function eventType(value: unknown): LifecycleEventType {
  const types: readonly WireEventType[] = [
    "run.started",
    "eval.started",
    "session.started",
    "eval.completed",
    "run.completed",
  ];
  if (typeof value !== "string" || !types.includes(value as WireEventType)) {
    throw new IngestRequestError(400, "event type is invalid.");
  }
  return value as LifecycleEventType;
}

function manifest(value: unknown): BeginEventInput["payload"] {
  if (!isRecord(value)) {
    throw new IngestRequestError(400, "payload must be an object.");
  }
  if (
    value.encoding !== "gzip" ||
    value.contentType !== "application/json" ||
    typeof value.byteLength !== "number" ||
    !Number.isInteger(value.byteLength) ||
    value.byteLength < 0 ||
    value.byteLength > MAX_PAYLOAD_BYTES ||
    typeof value.chunkSize !== "number" ||
    !Number.isInteger(value.chunkSize) ||
    value.chunkSize < 1 ||
    value.chunkSize > 256 * 1024 ||
    typeof value.chunkCount !== "number" ||
    !Number.isInteger(value.chunkCount) ||
    value.chunkCount < 1 ||
    value.chunkCount > MAX_CHUNKS ||
    typeof value.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.sha256) ||
    !isConsistentPayloadManifest({
      byteLength: value.byteLength,
      chunkSize: value.chunkSize,
      chunkCount: value.chunkCount,
    })
  ) {
    throw new IngestRequestError(400, "payload manifest is invalid.");
  }
  return {
    encoding: "gzip",
    contentType: "application/json",
    byteLength: value.byteLength,
    chunkSize: value.chunkSize,
    chunkCount: value.chunkCount,
    sha256: value.sha256,
  };
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new IngestRequestError(
      400,
      `${field} must be a non-negative integer.`,
    );
  }
  return value;
}

function projection(value: unknown): JsonObject {
  if (!isRecord(value) || !isJsonValue(value)) {
    throw new IngestRequestError(400, "projection must be a JSON object.");
  }
  if (value.run !== undefined) {
    if (!isRecord(value.run)) {
      throw new IngestRequestError(400, "projection.run must be an object.");
    }
    if (
      value.run.status !== undefined &&
      value.run.status !== "running" &&
      value.run.status !== "completed"
    ) {
      throw new IngestRequestError(400, "projection.run.status is invalid.");
    }
    if (value.run.completedAt !== undefined) {
      isoDate(value.run.completedAt, "projection.run.completedAt");
    }
    if (value.run.counts !== undefined) {
      if (!isRecord(value.run.counts)) {
        throw new IngestRequestError(400, "projection.run.counts is invalid.");
      }
      for (const field of [
        "total",
        "passed",
        "failed",
        "scored",
        "skipped",
        "errored",
      ] as const) {
        nonNegativeInteger(
          value.run.counts[field],
          `projection.run.counts.${field}`,
        );
      }
    }
  }
  if (value.evaluation !== undefined) {
    if (!isRecord(value.evaluation)) {
      throw new IngestRequestError(
        400,
        "projection.evaluation must be an object.",
      );
    }
    requiredString(value.evaluation.id, "projection.evaluation.id");
    if (
      value.evaluation.status !== "pending" &&
      value.evaluation.status !== "running" &&
      value.evaluation.status !== "completed"
    ) {
      throw new IngestRequestError(
        400,
        "projection.evaluation.status is invalid.",
      );
    }
    if (
      value.evaluation.verdict !== undefined &&
      value.evaluation.verdict !== "passed" &&
      value.evaluation.verdict !== "failed" &&
      value.evaluation.verdict !== "scored" &&
      value.evaluation.verdict !== "skipped"
    ) {
      throw new IngestRequestError(
        400,
        "projection.evaluation.verdict is invalid.",
      );
    }
    for (const field of [
      "assertionCount",
      "passedAssertionCount",
      "failedAssertionCount",
    ] as const) {
      if (value.evaluation[field] !== undefined) {
        nonNegativeInteger(
          value.evaluation[field],
          `projection.evaluation.${field}`,
        );
      }
    }
  }
  if (value.session !== undefined) {
    if (!isRecord(value.session)) {
      throw new IngestRequestError(
        400,
        "projection.session must be an object.",
      );
    }
    requiredString(
      value.session.evaluationId,
      "projection.session.evaluationId",
    );
    id(value.session.sessionId, "projection.session.sessionId");
    if (typeof value.session.primary !== "boolean") {
      throw new IngestRequestError(
        400,
        "projection.session.primary must be boolean.",
      );
    }
    isoDate(value.session.startedAt, "projection.session.startedAt");
  }
  return value as JsonObject;
}

function errorResponse(error: unknown): Response {
  if (error instanceof IngestRequestError) {
    return Response.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }
  if (
    error instanceof ZodError ||
    (error instanceof Error &&
      error.message.includes("database adapter is not implemented"))
  ) {
    return Response.json(
      { ok: false, error: "Database is not configured." },
      { status: 503 },
    );
  }
  if (error instanceof DatabaseAdapterError) {
    const status =
      error.code === "invalid"
        ? 400
        : error.code === "not-found"
          ? 404
          : error.code === "conflict" || error.code === "incomplete"
            ? 409
            : error.code === "too-large"
              ? 413
              : error.code === "unavailable"
                ? 503
                : 500;
    return Response.json({ ok: false, error: error.message }, { status });
  }
  console.error("[eve-insights] ingestion error", error);
  return Response.json(
    { ok: false, error: "Internal ingestion error." },
    { status: 500 },
  );
}

function success(value: Record<string, unknown>, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function handleCreateRun(
  request: Request,
  database: DatabaseSource,
): Promise<Response> {
  try {
    const adapter = await resolveDatabase(database);
    const body = protocol(
      await readBody(request),
      "run.create",
    ) as unknown as WireRunCreateRequest;
    const input: CreateRunInput = {
      runId: id(body.runId, "runId"),
      startedAt: isoDate(body.startedAt, "startedAt"),
      target: target(body.target),
      evaluations: evaluations(body.evaluations),
    };
    const result = await adapter.createRun(input);
    return success(
      { ok: true, runId: input.runId, created: result.created },
      result.created ? 201 : 200,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleBeginEvent(
  request: Request,
  runId: string,
  database: DatabaseSource,
): Promise<Response> {
  try {
    const adapter = await resolveDatabase(database);
    const body = protocol(
      await readBody(request),
      "event.begin",
    ) as unknown as WireEventBeginRequest;
    const input: BeginEventInput = {
      runId: id(runId, "runId"),
      eventId: id(body.eventId, "eventId"),
      sequence: (() => {
        if (
          typeof body.sequence !== "number" ||
          !Number.isInteger(body.sequence) ||
          body.sequence < 0
        ) {
          throw new IngestRequestError(
            400,
            "sequence must be a non-negative integer.",
          );
        }
        return body.sequence;
      })(),
      type: eventType(body.type),
      occurredAt: isoDate(body.occurredAt, "occurredAt"),
      projection: projection(body.projection),
      payload: manifest(body.payload),
    };
    const result = await adapter.beginEvent(input);
    return success(
      { ok: true, eventId: input.eventId, created: result.created },
      result.created ? 201 : 200,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleWriteEventChunk(
  request: Request,
  runId: string,
  eventId: string,
  database: DatabaseSource,
): Promise<Response> {
  try {
    const adapter = await resolveDatabase(database);
    const body = protocol(
      await readBody(request),
      "event.chunk",
    ) as unknown as WireEventChunkRequest;
    if (body.eventId !== eventId) {
      throw new IngestRequestError(400, "eventId does not match the route.");
    }
    const data = requiredString(body.data, "data", { maxLength: 400_000 });
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length % 4 !== 0) {
      throw new IngestRequestError(400, "data must be valid base64.");
    }
    const input: WriteEventChunkInput = {
      runId: id(runId, "runId"),
      eventId: id(eventId, "eventId"),
      index: (() => {
        if (
          typeof body.index !== "number" ||
          !Number.isInteger(body.index) ||
          body.index < 0
        ) {
          throw new IngestRequestError(
            400,
            "index must be a non-negative integer.",
          );
        }
        return body.index;
      })(),
      data,
    };
    const result = await adapter.writeEventChunk(input);
    return success({
      ok: true,
      eventId: input.eventId,
      index: input.index,
      created: result.created,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleCommitEvent(
  request: Request,
  runId: string,
  eventId: string,
  database: DatabaseSource,
): Promise<Response> {
  try {
    const adapter = await resolveDatabase(database);
    const body = protocol(
      await readBody(request, 16 * 1024),
      "event.commit",
    ) as unknown as WireEventCommitRequest;
    if (body.eventId !== eventId) {
      throw new IngestRequestError(400, "eventId does not match the route.");
    }
    const result = await adapter.commitEvent({
      runId: id(runId, "runId"),
      eventId: id(eventId, "eventId"),
    });
    return success({ ok: true, eventId, committed: result.committed });
  } catch (error) {
    return errorResponse(error);
  }
}
