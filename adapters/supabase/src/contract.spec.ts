import type { DatabaseAdapter } from "@eve-insights/adapter-types";
import { defineDatabaseAdapterContract } from "@eve-insights/adapter-types/contract";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beginEvent, commitEvent, writeEventChunk } from "./events.js";
import { createFakeSupabaseClient } from "./fake-client.js";
import { getRunReport, listAgents, listRuns } from "./queries.js";
import { createRun } from "./runs.js";

function harness() {
  const fake = createFakeSupabaseClient();
  const context = {
    client: fake as unknown as SupabaseClient,
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
      const rows = fake.tables.get("evaluations") ?? [];
      fake.tables.set(
        "evaluations",
        rows.filter((row) => row.run_id !== runId),
      );
    },
  };
}

defineDatabaseAdapterContract(harness);
