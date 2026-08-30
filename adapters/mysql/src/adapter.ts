import type {
  AdapterCommitResult,
  AdapterWriteResult,
  AgentRecord,
  AgentSelector,
  BeginEventInput,
  CommitEventInput,
  CreateRunInput,
  DatabaseAdapter,
  RunRecord,
  RunReport,
  WriteEventChunkInput,
} from "@eve-insights/adapter-types";
import { DatabaseAdapterError } from "@eve-insights/adapter-types";
import { createPool, type Pool } from "mysql2/promise";
import { beginEvent, commitEvent, writeEventChunk } from "./events.js";
import { getRunReport, listAgents, listRuns } from "./queries.js";
import { createRun } from "./runs.js";
import { createDrizzleStore } from "./store.js";
import {
  type AdapterContext,
  type MysqlAdapterOptions,
  mysqlAdapterOptionsSchema,
} from "./types.js";

interface NormalizedMysqlOptions {
  readonly host: string;
  readonly user: string;
  readonly password: string;
  readonly database: string;
  readonly port: number;
  readonly maxChunkBytes: number;
}

const poolCache = new Map<string, Pool>();

function poolKey(options: NormalizedMysqlOptions): string {
  return JSON.stringify({
    host: options.host,
    user: options.user,
    password: options.password,
    database: options.database,
    port: options.port,
  });
}

export function getMysqlPool(options: NormalizedMysqlOptions): Pool {
  const key = poolKey(options);
  const cached = poolCache.get(key);
  if (cached !== undefined) return cached;

  const pool = createPool({
    host: options.host,
    user: options.user,
    password: options.password,
    database: options.database,
    port: options.port,
  });
  poolCache.set(key, pool);
  return pool;
}

export function clearMysqlPoolCache(): void {
  poolCache.clear();
}

export class MysqlAdapter implements DatabaseAdapter {
  private readonly context: AdapterContext;

  constructor(options: MysqlAdapterOptions) {
    const normalized = mysqlAdapterOptionsSchema.parse(options);
    this.context = {
      store: createDrizzleStore(getMysqlPool(normalized)),
      maxChunkBytes: normalized.maxChunkBytes,
    };
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof DatabaseAdapterError) throw error;
      const message =
        error instanceof Error ? error.message : "Unknown database error";
      throw new DatabaseAdapterError(
        "unavailable",
        `MySQL database operation failed: ${message}`,
      );
    }
  }

  listAgents(): Promise<readonly AgentRecord[]> {
    return this.execute(() => listAgents(this.context));
  }

  listRuns(target: AgentSelector): Promise<readonly RunRecord[]> {
    return this.execute(() => listRuns(this.context, target));
  }

  getRunReport(
    target: AgentSelector,
    runId: string,
  ): Promise<RunReport | undefined> {
    return this.execute(() => getRunReport(this.context, target, runId));
  }

  createRun(input: CreateRunInput): Promise<AdapterWriteResult> {
    return this.execute(() => createRun(this.context, input));
  }

  beginEvent(input: BeginEventInput): Promise<AdapterWriteResult> {
    return this.execute(() => beginEvent(this.context, input));
  }

  writeEventChunk(input: WriteEventChunkInput): Promise<AdapterWriteResult> {
    return this.execute(() => writeEventChunk(this.context, input));
  }

  commitEvent(input: CommitEventInput): Promise<AdapterCommitResult> {
    return this.execute(() => commitEvent(this.context, input));
  }
}

export function createMysqlAdapter(
  options: MysqlAdapterOptions,
): DatabaseAdapter {
  return new MysqlAdapter(options);
}
