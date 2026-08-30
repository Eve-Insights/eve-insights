import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
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
import { type Client, createClient } from "@libsql/client";
import { applySqliteSchema } from "./bootstrap.js";
import { beginEvent, commitEvent, writeEventChunk } from "./events.js";
import { getRunReport, listAgents, listRuns } from "./queries.js";
import { createRun } from "./runs.js";
import { createDrizzleStore } from "./store.js";
import {
  type AdapterContext,
  type SqliteAdapterOptions,
  sqliteAdapterOptionsSchema,
} from "./types.js";

interface NormalizedSqliteOptions {
  readonly path: string;
  readonly maxChunkBytes: number;
}

const clientCache = new Map<string, Client>();
const clientReady = new Map<string, Promise<unknown>>();

export function toLibsqlUrl(path: string): string {
  if (
    path === ":memory:" ||
    path.startsWith("file:") ||
    path.startsWith("libsql:") ||
    path.startsWith("http:") ||
    path.startsWith("https:")
  ) {
    return path;
  }
  return `file:${path}`;
}

function ensureParentDirectory(url: string): void {
  if (!url.startsWith("file:")) return;
  const filePath = url.slice("file:".length);
  if (filePath.length === 0) return;
  mkdirSync(dirname(filePath), { recursive: true });
}

export function getSqliteClient(options: NormalizedSqliteOptions): Client {
  const key = options.path;
  const cached = clientCache.get(key);
  if (cached !== undefined) return cached;

  const url = toLibsqlUrl(options.path);
  ensureParentDirectory(url);
  const client = createClient({ url });
  clientCache.set(key, client);
  clientReady.set(key, applySqliteSchema(client));
  return client;
}

export function getSqliteClientReady(
  options: NormalizedSqliteOptions,
): Promise<unknown> {
  getSqliteClient(options);
  return clientReady.get(options.path) ?? Promise.resolve();
}

export function clearSqliteClientCache(): void {
  clientCache.clear();
  clientReady.clear();
}

export class SqliteAdapter implements DatabaseAdapter {
  private readonly context: AdapterContext;
  private readonly ready: Promise<unknown>;

  constructor(options: SqliteAdapterOptions) {
    const normalized = sqliteAdapterOptionsSchema.parse(options);
    const client = getSqliteClient(normalized);
    this.ready = getSqliteClientReady(normalized);
    this.context = {
      store: createDrizzleStore(client),
      maxChunkBytes: normalized.maxChunkBytes,
    };
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    await this.ready;
    try {
      return await operation();
    } catch (error) {
      if (error instanceof DatabaseAdapterError) throw error;
      const message =
        error instanceof Error ? error.message : "Unknown database error";
      throw new DatabaseAdapterError(
        "unavailable",
        `SQLite database operation failed: ${message}`,
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

export function createSqliteAdapter(
  options: SqliteAdapterOptions,
): DatabaseAdapter {
  return new SqliteAdapter(options);
}
