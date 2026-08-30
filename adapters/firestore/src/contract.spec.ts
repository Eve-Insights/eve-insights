import type { DatabaseAdapter } from "@eve-insights/adapter-types";
import { defineDatabaseAdapterContract } from "@eve-insights/adapter-types/contract";
import type { Firestore } from "@google-cloud/firestore";
import { beginEvent, commitEvent, writeEventChunk } from "./events.js";
import { FakeFirestore } from "./fake-firestore.js";
import { getRunReport, listAgents, listRuns } from "./queries.js";
import { createRun } from "./runs.js";

function harness() {
  const fake = new FakeFirestore();
  const context = {
    client: fake as unknown as Firestore,
    maxChunkBytes: 128,
  };
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
      const prefix = `evalRuns/${runId}/evaluations/`;
      for (const path of [...fake.store.keys()]) {
        if (path.startsWith(prefix)) fake.store.delete(path);
      }
    },
  };
}

defineDatabaseAdapterContract(harness);
