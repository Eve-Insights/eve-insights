/**
 * Database-neutral contracts for Eve Insights persistence adapters.
 *
 * These types intentionally contain only JSON-safe values and storage
 * operations. An adapter may use any database internally, but the ingestion
 * layer never needs to know which database was selected.
 */

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export enum DatabaseKind {
  FIRESTORE = "firestore",
  MYSQL = "mysql",
  POSTGRES = "postgres",
  SQLITE = "sqlite",
  SUPABASE = "supabase",
}
export type RunStatus = "running" | "completed";
export type EvaluationStatus = "pending" | "running" | "completed";
export type LifecycleEventType =
  | "run.started"
  | "eval.started"
  | "session.started"
  | "eval.completed"
  | "run.completed";

export interface RunCounts {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly scored: number;
  readonly skipped: number;
  readonly errored: number;
}

export interface TargetSnapshot {
  readonly agentId: string;
  readonly kind: "local" | "remote";
  readonly url: string;
  readonly name: string;
  readonly capabilities: {
    readonly devRoutes: boolean;
  };
}

/** The bounded subset of an Eve eval stored in queryable fields. */
export interface EvaluationRegistration {
  readonly id: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly timeoutMs?: number;
}

export interface SessionProjection {
  readonly evaluationId: string;
  readonly sessionId: string;
  readonly primary: boolean;
  readonly startedAt: string;
  readonly traceContext?: JsonObject;
}

export interface EvaluationProjection {
  readonly id: string;
  readonly status: EvaluationStatus;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly verdict?: "passed" | "failed" | "scored" | "skipped";
  readonly error?: string;
  readonly skipReason?: string;
  readonly assertionCount?: number;
  readonly passedAssertionCount?: number;
  readonly failedAssertionCount?: number;
}

export interface RunProjection {
  readonly status: RunStatus;
  readonly completedAt?: string;
  readonly counts?: RunCounts;
}

/**
 * A small indexable projection stored beside each immutable event payload.
 * Full callback data is stored through the payload manifest and chunks.
 */
export interface EventProjection {
  readonly run?: RunProjection;
  readonly evaluation?: EvaluationProjection;
  readonly session?: SessionProjection;
}

export interface PayloadManifest {
  readonly encoding: "gzip";
  readonly contentType: "application/json";
  readonly byteLength: number;
  readonly chunkSize: number;
  readonly chunkCount: number;
  readonly sha256: string;
}

export interface RunRecord extends TargetSnapshot {
  readonly runId: string;
  readonly startedAt: string;
  readonly status: RunStatus;
  readonly evaluationCount: number;
  readonly counts: RunCounts;
  readonly lastEventSequence: number;
  readonly completedAt?: string;
}

export interface AgentSelector {
  /** Agent ID used to select dashboard data. */
  readonly agentId: string;
}

export interface AgentRecord extends TargetSnapshot {
  /** Deterministic UUID derived from the agent name, used for dashboard navigation. */
  readonly agentId: string;
  readonly runCount: number;
  readonly evaluationCount: number;
  readonly lastRunStartedAt: string;
  readonly lastRunStatus: RunStatus;
}

export interface EvaluationRecord extends EvaluationRegistration {
  readonly status: EvaluationStatus;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly verdict?: "passed" | "failed" | "scored" | "skipped";
  readonly error?: string;
  readonly skipReason?: string;
  readonly assertionCount?: number;
  readonly passedAssertionCount?: number;
  readonly failedAssertionCount?: number;
}

export interface SessionRecord extends SessionProjection {
  readonly runId: string;
  readonly evaluationId: string;
}

export interface RunReport {
  readonly run: RunRecord;
  readonly evaluations: readonly EvaluationRecord[];
}

export interface EventRecord {
  readonly runId: string;
  readonly eventId: string;
  readonly sequence: number;
  readonly type: LifecycleEventType;
  readonly occurredAt: string;
  readonly projection: EventProjection;
  readonly payload: PayloadManifest;
  readonly status: "staged" | "committed";
  readonly committedAt?: string;
}

export interface PayloadChunkRecord {
  readonly runId: string;
  readonly eventId: string;
  readonly index: number;
  readonly data: string;
  readonly byteLength: number;
}

export interface CreateRunInput {
  readonly runId: string;
  readonly startedAt: string;
  readonly target: TargetSnapshot;
  readonly evaluations: readonly EvaluationRegistration[];
}

export type BeginEventInput = Omit<EventRecord, "status" | "committedAt"> & {
  readonly status?: "staged";
  readonly committedAt?: never;
};

export interface WriteEventChunkInput {
  readonly runId: string;
  readonly eventId: string;
  readonly index: number;
  readonly data: string;
}

export interface CommitEventInput {
  readonly runId: string;
  readonly eventId: string;
}

export interface AdapterWriteResult {
  readonly created: boolean;
}

export interface AdapterCommitResult {
  readonly committed: boolean;
}

export type DatabaseAdapterErrorCode =
  | "conflict"
  | "incomplete"
  | "invalid"
  | "not-found"
  | "too-large"
  | "unavailable";

export class DatabaseAdapterError extends Error {
  readonly code: DatabaseAdapterErrorCode;

  constructor(code: DatabaseAdapterErrorCode, message: string) {
    super(message);
    this.name = "DatabaseAdapterError";
    this.code = code;
  }
}

export interface DatabaseAdapter {
  listAgents(): Promise<readonly AgentRecord[]>;
  listRuns(target: AgentSelector): Promise<readonly RunRecord[]>;
  getRunReport(
    target: AgentSelector,
    runId: string,
  ): Promise<RunReport | undefined>;
  createRun(input: CreateRunInput): Promise<AdapterWriteResult>;
  beginEvent(input: BeginEventInput): Promise<AdapterWriteResult>;
  writeEventChunk(input: WriteEventChunkInput): Promise<AdapterWriteResult>;
  commitEvent(input: CommitEventInput): Promise<AdapterCommitResult>;
}

/**
 * True when `chunkCount` / `chunkSize` can produce `byteLength`.
 * Middle chunks are `chunkSize` bytes; only the last chunk may be shorter.
 * A zero-byte payload must be exactly one chunk.
 */
export function isConsistentPayloadManifest(
  payload: Pick<PayloadManifest, "byteLength" | "chunkSize" | "chunkCount">,
): boolean {
  const { byteLength, chunkSize, chunkCount } = payload;
  if (
    !Number.isInteger(byteLength) ||
    !Number.isInteger(chunkSize) ||
    !Number.isInteger(chunkCount) ||
    byteLength < 0 ||
    chunkSize < 1 ||
    chunkCount < 1
  ) {
    return false;
  }
  if (byteLength === 0) return chunkCount === 1;
  return (
    (chunkCount - 1) * chunkSize < byteLength &&
    chunkCount * chunkSize >= byteLength
  );
}

/** Package name, used to identify this adapter in diagnostics. */
export const PACKAGE_NAME = "@eve-insights/adapter-types";
