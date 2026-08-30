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
import { createClient } from "@supabase/supabase-js";
import { beginEvent, commitEvent, writeEventChunk } from "./events.js";
import { getRunReport, listAgents, listRuns } from "./queries.js";
import { createRun } from "./runs.js";
import {
  type AdapterContext,
  type SupabaseAdapterOptions,
  supabaseAdapterOptionsSchema,
} from "./types.js";

const clients = new Map<string, ReturnType<typeof createClient>>();

function supabaseClient(
  url: string,
  secretKey: string,
): ReturnType<typeof createClient> {
  const key = `${url}\0${secretKey}`;
  const existing = clients.get(key);
  if (existing) return existing;
  const client = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clients.set(key, client);
  return client;
}

export function clearSupabaseClientCache(): void {
  clients.clear();
}

export class SupabaseAdapter implements DatabaseAdapter {
  private readonly context: AdapterContext;

  constructor(options: SupabaseAdapterOptions) {
    const { url, secretKey, maxChunkBytes } =
      supabaseAdapterOptionsSchema.parse(options);

    this.context = {
      client: supabaseClient(url, secretKey),
      maxChunkBytes,
    };
  }

  listAgents(): Promise<readonly AgentRecord[]> {
    return listAgents(this.context);
  }

  listRuns(target: AgentSelector): Promise<readonly RunRecord[]> {
    return listRuns(this.context, target);
  }

  getRunReport(
    target: AgentSelector,
    runId: string,
  ): Promise<RunReport | undefined> {
    return getRunReport(this.context, target, runId);
  }

  createRun(input: CreateRunInput): Promise<AdapterWriteResult> {
    return createRun(this.context, input);
  }

  beginEvent(input: BeginEventInput): Promise<AdapterWriteResult> {
    return beginEvent(this.context, input);
  }

  writeEventChunk(input: WriteEventChunkInput): Promise<AdapterWriteResult> {
    return writeEventChunk(this.context, input);
  }

  commitEvent(input: CommitEventInput): Promise<AdapterCommitResult> {
    return commitEvent(this.context, input);
  }
}

export function createSupabaseAdapter(
  options: SupabaseAdapterOptions,
): DatabaseAdapter {
  return new SupabaseAdapter(options);
}
