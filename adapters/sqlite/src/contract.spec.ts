import type { DatabaseAdapter } from "@eve-insights/adapter-types";
import { defineDatabaseAdapterContract } from "@eve-insights/adapter-types/contract";
import { beginEvent, commitEvent, writeEventChunk } from "./events.js";
import { getRunReport, listAgents, listRuns } from "./queries.js";
import { createRun } from "./runs.js";
import { createMemoryStore } from "./store.js";

function harness() {
  const store = createMemoryStore();
  const context = { store, maxChunkBytes: 128 };
  const adapter: DatabaseAdapter = {
    listAgents: () => listAgents(context),
    listRuns: (target) => listRuns(context, target),
    getRunReport: (target, runId) => getRunReport(context, target, runId),
    createRun: (input) => createRun(context, input),
    beginEvent: (input) => beginEvent(context, input),
    writeEventChunk: (input) => writeEventChunk(context, input),
    commitEvent: (input) => commitEvent(context, input),
  };
  return {
    adapter,
    async dropEvaluations(runId: string) {
      await store.deleteEvaluationsForRun(runId);
    },
  };
}

defineDatabaseAdapterContract(harness);
