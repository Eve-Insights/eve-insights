import { createHash, randomUUID } from "node:crypto";
import type {
  EveEval,
  EveEvalResult,
  EveEvalRunSummary,
  EveEvalTarget,
} from "eve/evals";
import type {
  EvalReporter,
  EveEvalCompleteContext,
  EveEvalSessionStartEvent,
  EveEvalStartEvent,
} from "eve/evals/reporters";
import {
  INSIGHTS_PROTOCOL_VERSION,
  type WireEvaluationRegistration,
  type WireEvaluationSnapshot,
  type WireEventType,
  type WireJsonObject,
  type WireTarget,
} from "./protocol.js";
import { compressPayload, serializeForTransport } from "./serialize.js";

export {
  INSIGHTS_PROTOCOL_VERSION,
  type WireEvalCompletePayload,
  type WireEvalStartPayload,
  type WireEvaluationRegistration,
  type WireEvaluationSnapshot,
  type WireEventBeginRequest,
  type WireEventChunkRequest,
  type WireEventCommitRequest,
  type WireEventPayload,
  type WireEventType,
  type WireJsonObject,
  type WireJsonPrimitive,
  type WireJsonValue,
  type WirePayloadManifest,
  type WireRunCompletePayload,
  type WireRunCreateRequest,
  type WireRunStartPayload,
  type WireSessionStartPayload,
  type WireTarget,
} from "./protocol.js";

export interface InsightsReporterOptions {
  /** Base URL of the Insights app, for example `http://localhost:3000`. */
  readonly url: string;
  /** Unique display name for the agent shown in the Insights dashboard. */
  readonly agentName: string;
  /** Fetch implementation, useful for tests or custom transports. */
  readonly fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  /** Number of retries after the initial request. Defaults to two. */
  readonly retries?: number;
  /** Initial retry delay in milliseconds. Defaults to 250. */
  readonly retryDelayMs?: number;
  /** Per-request timeout in milliseconds. Defaults to 10 seconds. */
  readonly timeoutMs?: number;
  /** Maximum compressed payload chunk size in bytes. Defaults to 128 KiB. */
  readonly chunkSizeBytes?: number;
  /** Receives non-fatal delivery warnings. Defaults to `console.warn`. */
  readonly warn?: (message: string, error?: unknown) => void;
}

interface ActiveRun {
  readonly runId: string;
  readonly startedAt: string;
  readonly target: WireTarget;
  readonly evaluations: readonly EveEval[];
  registered: boolean;
  nextSequence: number;
}

const MAX_CHUNK_SIZE_BYTES = 256 * 1024;
const MAX_AGENT_NAME_LENGTH = 256;
const UUID_URL_NAMESPACE = Buffer.from(
  "6ba7b8119dad11d180b400c04fd430c8",
  "hex",
);

function agentIdForName(name: string): string {
  const bytes = createHash("sha1")
    .update(UUID_URL_NAMESPACE)
    .update(name)
    .digest();
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function asObject(value: unknown): WireJsonObject {
  const serialized = serializeForTransport(value);
  return serialized !== null &&
    typeof serialized === "object" &&
    !Array.isArray(serialized)
    ? serialized
    : { value: serialized };
}

function snapshotTarget(target: EveEvalTarget, agentName: string): WireTarget {
  return {
    agentId: agentIdForName(agentName),
    kind: target.kind,
    url: target.url,
    name: agentName,
    capabilities: {
      devRoutes: target.capabilities.devRoutes,
    },
  };
}

function snapshotModelId(model: unknown): string | undefined {
  if (typeof model === "string" && model.length > 0 && model.length <= 256) {
    return model;
  }
  if (model !== null && typeof model === "object") {
    const record = model as Record<string, unknown>;
    if (typeof record.modelId === "string" && record.modelId.length > 0) {
      return record.modelId;
    }
    if (typeof record.id === "string" && record.id.length > 0) {
      return record.id;
    }
  }
  return undefined;
}

function snapshotJudge(judge: unknown): WireJsonObject | undefined {
  if (judge === undefined) return undefined;
  if (typeof judge === "string") {
    return { model: judge };
  }
  if (judge !== null && typeof judge === "object") {
    const model = snapshotModelId((judge as { model?: unknown }).model);
    if (model !== undefined) return { model };
  }
  return { model: "unknown" };
}

function snapshotEvaluation(evaluation: EveEval): WireEvaluationSnapshot {
  const judge = snapshotJudge(evaluation.judge);
  const snapshot: WireEvaluationSnapshot = {
    id: evaluation.id,
    ...(evaluation.description === undefined
      ? {}
      : { description: evaluation.description }),
    ...(evaluation.tags === undefined ? {} : { tags: [...evaluation.tags] }),
    ...(evaluation.timeoutMs === undefined
      ? {}
      : { timeoutMs: evaluation.timeoutMs }),
    ...(evaluation.metadata === undefined
      ? {}
      : { metadata: asObject(evaluation.metadata) }),
    ...(judge === undefined ? {} : { judge }),
  };
  return snapshot;
}

function registrationFor(evaluation: EveEval): WireEvaluationRegistration {
  return {
    id: evaluation.id,
    ...(evaluation.description === undefined
      ? {}
      : { description: evaluation.description }),
    ...(evaluation.tags === undefined ? {} : { tags: [...evaluation.tags] }),
    ...(evaluation.timeoutMs === undefined
      ? {}
      : { timeoutMs: evaluation.timeoutMs }),
  };
}

function countsFromSummary(summary: EveEvalRunSummary): WireJsonObject {
  return {
    total: summary.results.length,
    passed: summary.passed,
    failed: summary.failed,
    scored: summary.scored,
    skipped: summary.skipped,
    errored: summary.errored,
  };
}

function projectionForResult(result: EveEvalResult): WireJsonObject {
  const failedAssertionCount = result.assertions.filter(
    (assertion) => !assertion.passed,
  ).length;
  return {
    evaluation: {
      id: result.id,
      status: "completed",
      completedAt: result.completedAt,
      verdict: result.verdict,
      ...(result.error === undefined ? {} : { error: result.error }),
      ...(result.skipReason === undefined
        ? {}
        : { skipReason: result.skipReason }),
      assertionCount: result.assertions.length,
      passedAssertionCount: result.assertions.length - failedAssertionCount,
      failedAssertionCount,
    },
  };
}

export class InsightsReporter implements EvalReporter {
  private readonly baseUrl: string;
  private readonly agentName: string;
  private readonly requestFetch: (
    input: string,
    init?: RequestInit,
  ) => Promise<Response>;
  private readonly retries: number;
  private readonly retryDelayMs: number;
  private readonly timeoutMs: number;
  private readonly chunkSizeBytes: number;
  private readonly warn: (message: string, error?: unknown) => void;
  private activeRun: ActiveRun | undefined;

  constructor(options: InsightsReporterOptions) {
    if (!options.url) throw new Error("Insights reporter requires a URL.");
    const agentName =
      typeof options.agentName === "string" ? options.agentName.trim() : "";
    if (!agentName || agentName.length > MAX_AGENT_NAME_LENGTH) {
      throw new Error(
        `Agent name must be between 1 and ${MAX_AGENT_NAME_LENGTH} characters.`,
      );
    }
    this.baseUrl = options.url.replace(/\/+$/, "");
    this.agentName = agentName;
    this.requestFetch = options.fetch ?? fetch;
    this.retries = Number.isFinite(options.retries)
      ? Math.max(0, Math.floor(options.retries as number))
      : 2;
    this.retryDelayMs = Number.isFinite(options.retryDelayMs)
      ? Math.max(0, options.retryDelayMs as number)
      : 250;
    this.timeoutMs = Number.isFinite(options.timeoutMs)
      ? Math.max(1, Math.floor(options.timeoutMs as number))
      : 10_000;
    this.chunkSizeBytes = options.chunkSizeBytes ?? 128 * 1024;
    if (
      !Number.isInteger(this.chunkSizeBytes) ||
      this.chunkSizeBytes < 1 ||
      this.chunkSizeBytes > MAX_CHUNK_SIZE_BYTES
    ) {
      throw new Error(
        `Payload chunk size must be between 1 and ${MAX_CHUNK_SIZE_BYTES} bytes.`,
      );
    }
    this.warn =
      options.warn ??
      ((message, error) => {
        console.warn(`[eve-insights] ${message}`, error);
      });
  }

  async onRunStart(
    evaluations: readonly EveEval[],
    target: EveEvalTarget,
  ): Promise<void> {
    try {
      this.activeRun = {
        runId: randomUUID(),
        startedAt: new Date().toISOString(),
        target: snapshotTarget(target, this.agentName),
        evaluations: [...evaluations],
        registered: false,
        nextSequence: 0,
      };
    } catch (error) {
      this.warn("Failed to start Insights run; continuing evals.", error);
      return;
    }

    await this.tryDeliver("run registration", () => this.registerRun());
    const run = this.activeRun;
    if (!run) return;

    await this.deliverEvent("run.started", run.startedAt, () => ({
      payload: {
        runId: run.runId,
        startedAt: run.startedAt,
        target: run.target,
        evaluations: run.evaluations.map(snapshotEvaluation),
      },
      projection: { run: { status: "running" } },
    }));
  }

  async onEvalStart(event: EveEvalStartEvent): Promise<void> {
    await this.deliverEvent("eval.started", event.startedAt, () => ({
      payload: {
        evaluation: snapshotEvaluation(event.evaluation),
        startedAt: event.startedAt,
        target: snapshotTarget(event.target, this.agentName),
      },
      projection: {
        evaluation: {
          id: event.evaluation.id,
          status: "running",
          startedAt: event.startedAt,
        },
      },
    }));
  }

  async onSessionStart(event: EveEvalSessionStartEvent): Promise<void> {
    await this.deliverEvent("session.started", event.startedAt, () => ({
      payload: {
        evaluation: snapshotEvaluation(event.evaluation),
        startedAt: event.startedAt,
        target: snapshotTarget(event.target, this.agentName),
        primary: event.primary,
        sessionId: event.sessionId,
        traceContext: asObject(event.traceContext),
      },
      projection: {
        session: {
          evaluationId: event.evaluation.id,
          sessionId: event.sessionId,
          primary: event.primary,
          startedAt: event.startedAt,
          traceContext: asObject(event.traceContext),
        },
      },
    }));
  }

  async onEvalComplete(
    result: EveEvalResult,
    context?: EveEvalCompleteContext,
  ): Promise<void> {
    await this.deliverEvent("eval.completed", result.completedAt, () => {
      const target = context?.target ?? this.activeRun?.target;
      const evaluation = context?.evaluation;
      return {
        payload: {
          ...(evaluation === undefined
            ? {}
            : { evaluation: snapshotEvaluation(evaluation) }),
          ...(target === undefined
            ? {}
            : {
                target:
                  typeof target === "object" && "kind" in target
                    ? snapshotTarget(target as EveEvalTarget, this.agentName)
                    : this.activeRun?.target,
              }),
          traceContexts: result.result.traceContexts.map(serializeForTransport),
          result: serializeForTransport(result),
          ...(context === undefined
            ? {}
            : {
                context: {
                  evaluation:
                    evaluation === undefined
                      ? null
                      : asObject(snapshotEvaluation(evaluation)),
                  target:
                    typeof context.target === "object" &&
                    "kind" in context.target
                      ? asObject(snapshotTarget(context.target, this.agentName))
                      : (this.activeRun?.target ?? {}),
                  traceContexts: context.traceContexts.map(
                    serializeForTransport,
                  ),
                },
              }),
        },
        projection: projectionForResult(result),
      };
    });
  }

  async onRunComplete(summary: EveEvalRunSummary): Promise<void> {
    const delivered = await this.deliverEvent(
      "run.completed",
      summary.completedAt,
      () => {
        const target = snapshotTarget(summary.target, this.agentName);
        const counts = countsFromSummary(summary);
        return {
          payload: {
            target,
            counts,
            evaluationIds: summary.results.map((result) => result.id),
          },
          projection: {
            run: {
              status: "completed",
              completedAt: summary.completedAt,
              counts,
            },
          },
        };
      },
    );
    if (delivered) this.activeRun = undefined;
  }

  private endpoint(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private async registerRun(): Promise<void> {
    const run = this.activeRun;
    if (!run || run.registered) return;

    await this.request("/api/v1/runs", {
      version: INSIGHTS_PROTOCOL_VERSION,
      action: "run.create",
      runId: run.runId,
      startedAt: run.startedAt,
      target: run.target,
      evaluations: run.evaluations.map(registrationFor),
    });
    run.registered = true;
  }

  private async deliverEvent(
    type: WireEventType,
    occurredAt: string,
    build: () => {
      payload: Record<string, unknown>;
      projection: WireJsonObject;
    },
  ): Promise<boolean> {
    const run = this.activeRun;
    if (!run) {
      this.warn(`Cannot deliver ${type}: no active run.`);
      return false;
    }

    const sequence = run.nextSequence++;
    const eventId = randomUUID();
    try {
      const { payload, projection } = build();
      await this.registerRun();
      const compressed = compressPayload(
        {
          version: INSIGHTS_PROTOCOL_VERSION,
          type,
          runId: run.runId,
          eventId,
          sequence,
          occurredAt,
          payload,
        },
        this.chunkSizeBytes,
      );
      await this.request(`/api/v1/runs/${run.runId}/events`, {
        version: INSIGHTS_PROTOCOL_VERSION,
        action: "event.begin",
        eventId,
        sequence,
        type,
        occurredAt,
        projection,
        payload: compressed.manifest,
      });
      for (const [index, data] of compressed.chunks.entries()) {
        await this.request(
          `/api/v1/runs/${run.runId}/events/${eventId}/chunks`,
          {
            version: INSIGHTS_PROTOCOL_VERSION,
            action: "event.chunk",
            eventId,
            index,
            data,
          },
        );
      }
      await this.request(`/api/v1/runs/${run.runId}/events/${eventId}/commit`, {
        version: INSIGHTS_PROTOCOL_VERSION,
        action: "event.commit",
        eventId,
      });
      return true;
    } catch (error) {
      this.warn(`Failed to deliver ${type} for run ${run.runId}.`, error);
      return false;
    }
  }

  private async tryDeliver(
    description: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    try {
      await operation();
    } catch (error) {
      this.warn(`Failed to deliver ${description}; continuing evals.`, error);
    }
  }

  private async request(path: string, body: object): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.requestFetch(this.endpoint(path), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (response.ok) return;
        const detail = await response.text();
        const error = new InsightsHttpError(
          response.status,
          `Insights responded ${response.status}: ${detail || response.statusText}`,
        );
        if (!isRetryableStatus(response.status) || attempt >= this.retries) {
          throw error;
        }
        lastError = error;
      } catch (error) {
        lastError = error;
        if (attempt >= this.retries || !isRetryableError(error)) {
          throw error instanceof Error ? error : new Error(String(error));
        }
      } finally {
        clearTimeout(timer);
      }
      if (this.retryDelayMs > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelayMs * 2 ** attempt),
        );
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

class InsightsHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "InsightsHttpError";
    this.status = status;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof InsightsHttpError) {
    return isRetryableStatus(error.status);
  }
  return true;
}

export function insightsReporter(
  options: InsightsReporterOptions,
): EvalReporter {
  return new InsightsReporter(options);
}

/** Package name, used to identify the client to the platform. */
export const PACKAGE_NAME = "@eve-insights/reporter";
