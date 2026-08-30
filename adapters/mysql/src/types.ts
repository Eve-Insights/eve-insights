import { z } from "zod";
import { MAX_CHUNK_BYTES } from "./constants.js";

export const mysqlAdapterOptionsSchema = z.compile(
  z.object({
    host: z.string().trim().min(1),
    user: z.string().trim().min(1),
    password: z.string().min(1),
    database: z.string().trim().min(1),
    port: z
      .union([
        z.number().int().min(1).max(65_535),
        z.string().regex(/^\d+$/).transform(Number),
      ])
      .default(3306),
    maxChunkBytes: z
      .number()
      .int()
      .min(1)
      .max(MAX_CHUNK_BYTES)
      .default(MAX_CHUNK_BYTES),
  }),
);

export type MysqlAdapterOptions = z.input<typeof mysqlAdapterOptionsSchema>;

export type StoreRecord = Record<string, unknown>;

export interface AdapterStore {
  getRun(runId: string): Promise<StoreRecord | undefined>;
  listRuns(agentId?: string): Promise<readonly StoreRecord[]>;
  insertRun(run: StoreRecord): Promise<void>;
  updateRun(runId: string, patch: StoreRecord): Promise<void>;

  listEvaluations(runId: string): Promise<readonly StoreRecord[]>;
  getEvaluation(
    runId: string,
    evaluationId: string,
  ): Promise<StoreRecord | undefined>;
  insertEvaluation(evaluation: StoreRecord): Promise<void>;
  updateEvaluation(
    runId: string,
    evaluationId: string,
    patch: StoreRecord,
  ): Promise<void>;

  getEvent(runId: string, eventId: string): Promise<StoreRecord | undefined>;
  insertEvent(event: StoreRecord): Promise<void>;
  updateEvent(
    runId: string,
    eventId: string,
    patch: StoreRecord,
  ): Promise<void>;
  markEventCommitted(
    runId: string,
    eventId: string,
    committedAt: string,
  ): Promise<boolean>;

  listChunks(runId: string, eventId: string): Promise<readonly StoreRecord[]>;
  getChunk(
    runId: string,
    eventId: string,
    index: number,
  ): Promise<StoreRecord | undefined>;
  insertChunk(chunk: StoreRecord): Promise<void>;

  upsertSession(session: StoreRecord): Promise<void>;

  transaction<T>(
    callback: (transaction: AdapterStore) => Promise<T>,
  ): Promise<T>;
}

export interface AdapterContext {
  readonly store: AdapterStore;
  readonly maxChunkBytes: number;
}
