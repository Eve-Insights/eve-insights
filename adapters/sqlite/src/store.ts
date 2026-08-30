import { DatabaseAdapterError } from "@eve-insights/adapter-types";
import type { Client } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import {
  evaluations,
  eventChunks,
  events,
  runs,
  sessions,
  sqliteSchema,
} from "./schema.js";
import type { AdapterStore, StoreRecord } from "./types.js";

type SqliteDatabase = LibSQLDatabase<typeof sqliteSchema>;

function key(...parts: readonly (string | number)[]): string {
  return parts.join("\u0000");
}

function mapRun(row: typeof runs.$inferSelect): StoreRecord {
  return {
    runId: row.runId,
    agentId: row.agentId,
    startedAt: row.startedAt,
    kind: row.kind,
    url: row.url,
    name: row.name,
    capabilities: row.capabilities,
    status: row.status,
    evaluationCount: row.evaluationCount,
    counts: row.counts,
    lastEventSequence: row.lastEventSequence,
    ...(row.completedAt === null ? {} : { completedAt: row.completedAt }),
  };
}

function mapEvaluation(row: typeof evaluations.$inferSelect): StoreRecord {
  return {
    id: row.evaluationId,
    status: row.status,
    ...(row.description === null ? {} : { description: row.description }),
    ...(row.tags === null ? {} : { tags: row.tags }),
    ...(row.timeoutMs === null ? {} : { timeoutMs: row.timeoutMs }),
    ...(row.startedAt === null ? {} : { startedAt: row.startedAt }),
    ...(row.completedAt === null ? {} : { completedAt: row.completedAt }),
    ...(row.verdict === null ? {} : { verdict: row.verdict }),
    ...(row.error === null ? {} : { error: row.error }),
    ...(row.skipReason === null ? {} : { skipReason: row.skipReason }),
    ...(row.assertionCount === null
      ? {}
      : { assertionCount: row.assertionCount }),
    ...(row.passedAssertionCount === null
      ? {}
      : { passedAssertionCount: row.passedAssertionCount }),
    ...(row.failedAssertionCount === null
      ? {}
      : { failedAssertionCount: row.failedAssertionCount }),
  };
}

function mapEvent(row: typeof events.$inferSelect): StoreRecord {
  return {
    runId: row.runId,
    eventId: row.eventId,
    sequence: row.sequence,
    type: row.type,
    occurredAt: row.occurredAt,
    projection: row.projection,
    payload: {
      encoding: row.payloadEncoding,
      contentType: row.payloadContentType,
      byteLength: row.payloadByteLength,
      chunkSize: row.payloadChunkSize,
      chunkCount: row.payloadChunkCount,
      sha256: row.payloadSha256,
    },
    status: row.status,
    ...(row.committedAt === null ? {} : { committedAt: row.committedAt }),
  };
}

function mapChunk(row: typeof eventChunks.$inferSelect): StoreRecord {
  return {
    runId: row.runId,
    eventId: row.eventId,
    index: row.chunkIndex,
    data: row.data,
    byteLength: row.byteLength,
  };
}

export class DrizzleAdapterStore implements AdapterStore {
  constructor(private readonly database: SqliteDatabase) {}

  async getRun(runId: string): Promise<StoreRecord | undefined> {
    const rows = await this.database
      .select()
      .from(runs)
      .where(eq(runs.runId, runId))
      .limit(1);
    const row = rows[0];
    return row === undefined ? undefined : mapRun(row);
  }

  async listRuns(agentId?: string): Promise<readonly StoreRecord[]> {
    const rows =
      agentId === undefined
        ? await this.database.select().from(runs)
        : await this.database
            .select()
            .from(runs)
            .where(eq(runs.agentId, agentId));
    return rows.map(mapRun);
  }

  async insertRun(run: StoreRecord): Promise<void> {
    await this.database.insert(runs).values({
      runId: String(run.runId),
      agentId: String(run.agentId),
      startedAt: String(run.startedAt),
      kind: String(run.kind),
      url: String(run.url),
      name: String(run.name),
      capabilities: run.capabilities,
      status: String(run.status),
      evaluationCount: Number(run.evaluationCount),
      counts: run.counts,
      lastEventSequence: Number(run.lastEventSequence),
      completedAt: (run.completedAt as string | undefined) ?? null,
    });
  }

  async updateRun(runId: string, patch: StoreRecord): Promise<void> {
    const values: Partial<typeof runs.$inferInsert> = {};
    if ("status" in patch) values.status = String(patch.status);
    if ("completedAt" in patch) {
      values.completedAt = (patch.completedAt as string | undefined) ?? null;
    }
    if ("counts" in patch) values.counts = patch.counts;
    if ("lastEventSequence" in patch) {
      values.lastEventSequence = Number(patch.lastEventSequence);
    }
    if (Object.keys(values).length === 0) return;
    await this.database.update(runs).set(values).where(eq(runs.runId, runId));
  }

  async listEvaluations(runId: string): Promise<readonly StoreRecord[]> {
    const rows = await this.database
      .select()
      .from(evaluations)
      .where(eq(evaluations.runId, runId));
    return rows.map(mapEvaluation);
  }

  async getEvaluation(
    runId: string,
    evaluationId: string,
  ): Promise<StoreRecord | undefined> {
    const rows = await this.database
      .select()
      .from(evaluations)
      .where(
        and(
          eq(evaluations.runId, runId),
          eq(evaluations.evaluationId, evaluationId),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row === undefined ? undefined : mapEvaluation(row);
  }

  async insertEvaluation(evaluation: StoreRecord): Promise<void> {
    await this.database.insert(evaluations).values({
      runId: String(evaluation.runId),
      evaluationId: String(evaluation.id),
      description: (evaluation.description as string | undefined) ?? null,
      tags: evaluation.tags,
      timeoutMs: (evaluation.timeoutMs as number | undefined) ?? null,
      status: String(evaluation.status),
      startedAt: (evaluation.startedAt as string | undefined) ?? null,
      completedAt: (evaluation.completedAt as string | undefined) ?? null,
      verdict: (evaluation.verdict as string | undefined) ?? null,
      error: (evaluation.error as string | undefined) ?? null,
      skipReason: (evaluation.skipReason as string | undefined) ?? null,
      assertionCount: (evaluation.assertionCount as number | undefined) ?? null,
      passedAssertionCount:
        (evaluation.passedAssertionCount as number | undefined) ?? null,
      failedAssertionCount:
        (evaluation.failedAssertionCount as number | undefined) ?? null,
    });
  }

  async updateEvaluation(
    runId: string,
    evaluationId: string,
    patch: StoreRecord,
  ): Promise<void> {
    const values: Partial<typeof evaluations.$inferInsert> = {};
    if ("description" in patch) {
      values.description = (patch.description as string | undefined) ?? null;
    }
    if ("tags" in patch) values.tags = patch.tags;
    if ("timeoutMs" in patch) {
      values.timeoutMs = (patch.timeoutMs as number | undefined) ?? null;
    }
    if ("status" in patch) values.status = String(patch.status);
    if ("startedAt" in patch) {
      values.startedAt = (patch.startedAt as string | undefined) ?? null;
    }
    if ("completedAt" in patch) {
      values.completedAt = (patch.completedAt as string | undefined) ?? null;
    }
    if ("verdict" in patch) values.verdict = String(patch.verdict);
    if ("error" in patch) {
      values.error = (patch.error as string | undefined) ?? null;
    }
    if ("skipReason" in patch) {
      values.skipReason = (patch.skipReason as string | undefined) ?? null;
    }
    if ("assertionCount" in patch) {
      values.assertionCount = Number(patch.assertionCount);
    }
    if ("passedAssertionCount" in patch) {
      values.passedAssertionCount = Number(patch.passedAssertionCount);
    }
    if ("failedAssertionCount" in patch) {
      values.failedAssertionCount = Number(patch.failedAssertionCount);
    }
    if (Object.keys(values).length === 0) return;
    await this.database
      .update(evaluations)
      .set(values)
      .where(
        and(
          eq(evaluations.runId, runId),
          eq(evaluations.evaluationId, evaluationId),
        ),
      );
  }

  async getEvent(
    runId: string,
    eventId: string,
  ): Promise<StoreRecord | undefined> {
    const rows = await this.database
      .select()
      .from(events)
      .where(and(eq(events.runId, runId), eq(events.eventId, eventId)))
      .limit(1);
    const row = rows[0];
    return row === undefined ? undefined : mapEvent(row);
  }

  async insertEvent(event: StoreRecord): Promise<void> {
    await this.database.insert(events).values({
      runId: String(event.runId),
      eventId: String(event.eventId),
      sequence: Number(event.sequence),
      type: String(event.type),
      occurredAt: String(event.occurredAt),
      projection: event.projection,
      payloadEncoding: String((event.payload as StoreRecord).encoding),
      payloadContentType: String((event.payload as StoreRecord).contentType),
      payloadByteLength: Number((event.payload as StoreRecord).byteLength),
      payloadChunkSize: Number((event.payload as StoreRecord).chunkSize),
      payloadChunkCount: Number((event.payload as StoreRecord).chunkCount),
      payloadSha256: String((event.payload as StoreRecord).sha256),
      status: String(event.status),
      committedAt: (event.committedAt as string | undefined) ?? null,
    });
  }

  async updateEvent(
    runId: string,
    eventId: string,
    patch: StoreRecord,
  ): Promise<void> {
    const values: Partial<typeof events.$inferInsert> = {};
    if ("status" in patch) values.status = String(patch.status);
    if ("committedAt" in patch) {
      values.committedAt = (patch.committedAt as string | undefined) ?? null;
    }
    if (Object.keys(values).length === 0) return;
    await this.database
      .update(events)
      .set(values)
      .where(and(eq(events.runId, runId), eq(events.eventId, eventId)));
  }

  async markEventCommitted(
    runId: string,
    eventId: string,
    committedAt: string,
  ): Promise<boolean> {
    const result = await this.database
      .update(events)
      .set({ status: "committed", committedAt })
      .where(
        and(
          eq(events.runId, runId),
          eq(events.eventId, eventId),
          eq(events.status, "staged"),
        ),
      );
    return result.rowsAffected === 1;
  }

  async listChunks(
    runId: string,
    eventId: string,
  ): Promise<readonly StoreRecord[]> {
    const rows = await this.database
      .select()
      .from(eventChunks)
      .where(
        and(eq(eventChunks.runId, runId), eq(eventChunks.eventId, eventId)),
      );
    return rows.map(mapChunk);
  }

  async getChunk(
    runId: string,
    eventId: string,
    index: number,
  ): Promise<StoreRecord | undefined> {
    const rows = await this.database
      .select()
      .from(eventChunks)
      .where(
        and(
          eq(eventChunks.runId, runId),
          eq(eventChunks.eventId, eventId),
          eq(eventChunks.chunkIndex, index),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row === undefined ? undefined : mapChunk(row);
  }

  async insertChunk(chunk: StoreRecord): Promise<void> {
    await this.database.insert(eventChunks).values({
      runId: String(chunk.runId),
      eventId: String(chunk.eventId),
      chunkIndex: Number(chunk.index),
      data: String(chunk.data),
      byteLength: Number(chunk.byteLength),
    });
  }

  async upsertSession(session: StoreRecord): Promise<void> {
    await this.database
      .insert(sessions)
      .values({
        runId: String(session.runId),
        sessionId: String(session.sessionId),
        evaluationId: String(session.evaluationId),
        isPrimary: Boolean(session.primary),
        startedAt: String(session.startedAt),
        traceContext: session.traceContext ?? null,
      })
      .onConflictDoUpdate({
        target: [sessions.runId, sessions.sessionId],
        set: {
          evaluationId: String(session.evaluationId),
          isPrimary: Boolean(session.primary),
          startedAt: String(session.startedAt),
          traceContext: session.traceContext ?? null,
        },
      });
  }

  async transaction<T>(
    callback: (transaction: AdapterStore) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (transaction) =>
      callback(
        new DrizzleAdapterStore(transaction as unknown as SqliteDatabase),
      ),
    );
  }
}

export function createDrizzleStore(client: Client): AdapterStore {
  return new DrizzleAdapterStore(drizzle(client, { schema: sqliteSchema }));
}

interface MemoryState {
  readonly runs: Map<string, StoreRecord>;
  readonly evaluations: Map<string, StoreRecord>;
  readonly events: Map<string, StoreRecord>;
  readonly chunks: Map<string, StoreRecord>;
  readonly sessions: Map<string, StoreRecord>;
}

function cloneState(state: MemoryState): MemoryState {
  const cloneMap = (source: Map<string, StoreRecord>) =>
    new Map(
      [...source.entries()].map(([entryKey, value]) => [
        entryKey,
        structuredClone(value),
      ]),
    );
  return {
    runs: cloneMap(state.runs),
    evaluations: cloneMap(state.evaluations),
    events: cloneMap(state.events),
    chunks: cloneMap(state.chunks),
    sessions: cloneMap(state.sessions),
  };
}

function newMemoryState(): MemoryState {
  return {
    runs: new Map(),
    evaluations: new Map(),
    events: new Map(),
    chunks: new Map(),
    sessions: new Map(),
  };
}

export class MemoryAdapterStore implements AdapterStore {
  private readonly state: MemoryState;
  private transactionTail = Promise.resolve();

  constructor(state: MemoryState = newMemoryState()) {
    this.state = state;
  }

  async getRun(runId: string): Promise<StoreRecord | undefined> {
    const value = this.state.runs.get(runId);
    return value === undefined ? undefined : structuredClone(value);
  }

  async listRuns(agentId?: string): Promise<readonly StoreRecord[]> {
    return [...this.state.runs.values()]
      .filter((run) => agentId === undefined || run.agentId === agentId)
      .map((run) => structuredClone(run));
  }

  async insertRun(run: StoreRecord): Promise<void> {
    const runId = String(run.runId);
    if (this.state.runs.has(runId)) {
      throw new DatabaseAdapterError(
        "conflict",
        `Run ${runId} already exists.`,
      );
    }
    this.state.runs.set(runId, structuredClone(run));
  }

  async updateRun(runId: string, patch: StoreRecord): Promise<void> {
    const current = this.state.runs.get(runId);
    if (current === undefined) {
      throw new DatabaseAdapterError(
        "not-found",
        `Run ${runId} was not found.`,
      );
    }
    this.state.runs.set(runId, { ...current, ...structuredClone(patch) });
  }

  async listEvaluations(runId: string): Promise<readonly StoreRecord[]> {
    return [...this.state.evaluations.entries()]
      .filter(([entryKey]) => entryKey.startsWith(`${runId}\u0000`))
      .map(([, evaluation]) => structuredClone(evaluation));
  }

  async getEvaluation(
    runId: string,
    evaluationId: string,
  ): Promise<StoreRecord | undefined> {
    const value = this.state.evaluations.get(key(runId, evaluationId));
    return value === undefined ? undefined : structuredClone(value);
  }

  async insertEvaluation(evaluation: StoreRecord): Promise<void> {
    const entryKey = key(evaluation.runId as string, evaluation.id as string);
    if (this.state.evaluations.has(entryKey)) {
      throw new DatabaseAdapterError(
        "conflict",
        `Evaluation ${String(evaluation.id)} already exists.`,
      );
    }
    this.state.evaluations.set(entryKey, structuredClone(evaluation));
  }

  async updateEvaluation(
    runId: string,
    evaluationId: string,
    patch: StoreRecord,
  ): Promise<void> {
    const entryKey = key(runId, evaluationId);
    const current = this.state.evaluations.get(entryKey);
    if (current === undefined) {
      throw new DatabaseAdapterError(
        "not-found",
        `Evaluation ${evaluationId} was not found.`,
      );
    }
    this.state.evaluations.set(entryKey, {
      ...current,
      ...structuredClone(patch),
    });
  }

  async getEvent(
    runId: string,
    eventId: string,
  ): Promise<StoreRecord | undefined> {
    const value = this.state.events.get(key(runId, eventId));
    return value === undefined ? undefined : structuredClone(value);
  }

  async insertEvent(event: StoreRecord): Promise<void> {
    const entryKey = key(event.runId as string, event.eventId as string);
    if (this.state.events.has(entryKey)) {
      throw new DatabaseAdapterError(
        "conflict",
        `Event ${String(event.eventId)} already exists.`,
      );
    }
    if (
      event.sequence !== undefined &&
      [...this.state.events.values()].some(
        (existing) =>
          existing.runId === event.runId &&
          existing.sequence === event.sequence,
      )
    ) {
      throw new DatabaseAdapterError(
        "conflict",
        `Event sequence ${String(event.sequence)} already exists.`,
      );
    }
    this.state.events.set(entryKey, structuredClone(event));
  }

  async deleteEvaluationsForRun(runId: string): Promise<void> {
    for (const entryKey of [...this.state.evaluations.keys()]) {
      if (entryKey.startsWith(`${runId}\u0000`)) {
        this.state.evaluations.delete(entryKey);
      }
    }
  }

  async updateEvent(
    runId: string,
    eventId: string,
    patch: StoreRecord,
  ): Promise<void> {
    const entryKey = key(runId, eventId);
    const current = this.state.events.get(entryKey);
    if (current === undefined) {
      throw new DatabaseAdapterError(
        "not-found",
        `Event ${eventId} was not found.`,
      );
    }
    this.state.events.set(entryKey, {
      ...current,
      ...structuredClone(patch),
    });
  }

  async markEventCommitted(
    runId: string,
    eventId: string,
    committedAt: string,
  ): Promise<boolean> {
    const current = await this.getEvent(runId, eventId);
    if (current === undefined || current.status !== "staged") return false;
    await this.updateEvent(runId, eventId, {
      status: "committed",
      committedAt,
    });
    return true;
  }

  async listChunks(
    runId: string,
    eventId: string,
  ): Promise<readonly StoreRecord[]> {
    const prefix = `${key(runId, eventId)}\u0000`;
    return [...this.state.chunks.entries()]
      .filter(([entryKey]) => entryKey.startsWith(prefix))
      .map(([, chunk]) => structuredClone(chunk));
  }

  async getChunk(
    runId: string,
    eventId: string,
    index: number,
  ): Promise<StoreRecord | undefined> {
    const value = this.state.chunks.get(key(runId, eventId, index));
    return value === undefined ? undefined : structuredClone(value);
  }

  async insertChunk(chunk: StoreRecord): Promise<void> {
    const entryKey = key(
      chunk.runId as string,
      chunk.eventId as string,
      chunk.index as number,
    );
    if (this.state.chunks.has(entryKey)) {
      throw new DatabaseAdapterError(
        "conflict",
        `Chunk ${String(chunk.index)} already exists.`,
      );
    }
    this.state.chunks.set(entryKey, structuredClone(chunk));
  }

  async upsertSession(session: StoreRecord): Promise<void> {
    this.state.sessions.set(
      key(session.runId as string, session.sessionId as string),
      structuredClone(session),
    );
  }

  async transaction<T>(
    callback: (transaction: AdapterStore) => Promise<T>,
  ): Promise<T> {
    const run = this.transactionTail.then(() =>
      this.applyTransaction(callback),
    );
    this.transactionTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async applyTransaction<T>(
    callback: (transaction: AdapterStore) => Promise<T>,
  ): Promise<T> {
    const transactionState = cloneState(this.state);
    const result = await callback(new MemoryAdapterStore(transactionState));
    for (const [entryKey, value] of transactionState.runs) {
      this.state.runs.set(entryKey, value);
    }
    for (const [entryKey, value] of transactionState.evaluations) {
      this.state.evaluations.set(entryKey, value);
    }
    for (const [entryKey, value] of transactionState.events) {
      this.state.events.set(entryKey, value);
    }
    for (const [entryKey, value] of transactionState.chunks) {
      this.state.chunks.set(entryKey, value);
    }
    for (const [entryKey, value] of transactionState.sessions) {
      this.state.sessions.set(entryKey, value);
    }
    return result;
  }
}

export function createMemoryStore(): MemoryAdapterStore {
  return new MemoryAdapterStore();
}
