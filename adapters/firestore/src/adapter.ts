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
import { Firestore } from "@google-cloud/firestore";
import { beginEvent, commitEvent, writeEventChunk } from "./events.js";
import { getRunReport, listAgents, listRuns } from "./queries.js";
import { createRun } from "./runs.js";
import {
  type AdapterContext,
  type FirestoreAdapterOptions,
  firestoreAdapterOptionsSchema,
} from "./types.js";

const clients = new Map<string, Firestore>();

function firestoreClient(projectId: string): Firestore {
  const existing = clients.get(projectId);
  if (existing) return existing;
  const client = new Firestore({ projectId });
  clients.set(projectId, client);
  return client;
}

export function clearFirestoreClientCache(): void {
  clients.clear();
}

export class FirestoreAdapter implements DatabaseAdapter {
  private readonly context: AdapterContext;

  constructor(options: FirestoreAdapterOptions) {
    const { projectId, maxChunkBytes } =
      firestoreAdapterOptionsSchema.parse(options);

    this.context = {
      client: firestoreClient(projectId),
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

export function createFirestoreAdapter(
  options: FirestoreAdapterOptions,
): DatabaseAdapter {
  return new FirestoreAdapter(options);
}
