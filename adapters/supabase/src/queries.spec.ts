import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  createFakeSupabaseClient,
  type FakeSupabaseClient,
} from "./fake-client.js";
import { getRunReport, listAgents, listRuns } from "./queries.js";
import { createRun } from "./runs.js";

const target = {
  agentId: "11111111-1111-5111-8111-111111111111",
  kind: "local" as const,
  url: "http://localhost:3002",
  name: "Weather Agent",
  capabilities: { devRoutes: true },
};

function context(): {
  client: SupabaseClient;
  fake: FakeSupabaseClient;
  maxChunkBytes: number;
} {
  const fake = createFakeSupabaseClient();
  return {
    client: fake as unknown as SupabaseClient,
    fake,
    maxChunkBytes: 128,
  };
}

async function seed() {
  const adapterContext = context();
  await createRun(adapterContext, {
    runId: "old",
    startedAt: "2026-08-29T00:00:00.000Z",
    target,
    evaluations: [{ id: "weather/zulu" }],
  });
  await createRun(adapterContext, {
    runId: "new",
    startedAt: "2026-08-30T00:00:00.000Z",
    target,
    evaluations: [{ id: "weather/zulu" }, { id: "weather/alpha" }],
  });
  await createRun(adapterContext, {
    runId: "other",
    startedAt: "2026-08-31T00:00:00.000Z",
    target: {
      ...target,
      agentId: "22222222-2222-5222-8222-222222222222",
      kind: "remote",
      url: "https://agent.example",
      name: "Support Agent",
      capabilities: { devRoutes: false },
    },
    evaluations: [],
  });
  return adapterContext;
}

describe("queries", () => {
  describe("listAgents", () => {
    it("groups agents and uses the newest run snapshot", async () => {
      const adapterContext = await seed();

      await expect(listAgents(adapterContext)).resolves.toEqual([
        {
          agentId: "22222222-2222-5222-8222-222222222222",
          kind: "remote",
          url: "https://agent.example",
          name: "Support Agent",
          capabilities: { devRoutes: false },
          runCount: 1,
          evaluationCount: 0,
          lastRunStartedAt: "2026-08-31T00:00:00.000Z",
          lastRunStatus: "running",
        },
        {
          agentId: target.agentId,
          kind: "local",
          url: target.url,
          name: target.name,
          capabilities: target.capabilities,
          runCount: 2,
          evaluationCount: 3,
          lastRunStartedAt: "2026-08-30T00:00:00.000Z",
          lastRunStatus: "running",
        },
      ]);
    });

    it("skips malformed runs and sorts equal dates by URL", async () => {
      const adapterContext = context();
      await createRun(adapterContext, {
        runId: "zeta",
        startedAt: "2026-08-30T00:00:00.000Z",
        target: {
          ...target,
          agentId: "zeta-agent",
          url: "http://zeta.example",
        },
        evaluations: [],
      });
      await createRun(adapterContext, {
        runId: "alpha",
        startedAt: "2026-08-30T00:00:00.000Z",
        target: {
          ...target,
          agentId: "alpha-agent",
          url: "http://alpha.example",
        },
        evaluations: [],
      });
      adapterContext.fake.tables.set("eval_runs", [
        ...(adapterContext.fake.tables.get("eval_runs") ?? []),
        { run_id: "broken" },
      ]);

      await expect(listAgents(adapterContext)).resolves.toEqual([
        expect.objectContaining({ url: "http://alpha.example" }),
        expect.objectContaining({ url: "http://zeta.example" }),
      ]);
    });
  });

  describe("listRuns", () => {
    it("lists only the selected agent's runs in descending order", async () => {
      const adapterContext = await seed();
      adapterContext.fake.tables.set("eval_runs", [
        ...(adapterContext.fake.tables.get("eval_runs") ?? []),
        { run_id: "broken" },
      ]);

      const runs = await listRuns(adapterContext, {
        agentId: target.agentId,
      });
      expect(runs.map((item) => item.runId)).toEqual(["new", "old"]);
    });

    it("breaks run ties by run ID", async () => {
      const adapterContext = context();
      await createRun(adapterContext, {
        runId: "b-run",
        startedAt: "2026-08-30T00:00:00.000Z",
        target,
        evaluations: [],
      });
      await createRun(adapterContext, {
        runId: "a-run",
        startedAt: "2026-08-30T00:00:00.000Z",
        target,
        evaluations: [],
      });

      const runs = await listRuns(adapterContext, target);
      expect(runs.map((item) => item.runId)).toEqual(["a-run", "b-run"]);
    });
  });

  describe("getRunReport", () => {
    it("loads sorted evaluations and treats another agent as a miss", async () => {
      const adapterContext = await seed();
      adapterContext.fake.tables.set("evaluations", [
        ...(adapterContext.fake.tables.get("evaluations") ?? []),
        { run_id: "new", evaluation_id: "" },
      ]);

      await expect(
        getRunReport(adapterContext, target, "new"),
      ).resolves.toMatchObject({
        run: { runId: "new" },
        evaluations: [{ id: "weather/alpha" }, { id: "weather/zulu" }],
      });
      await expect(
        getRunReport(adapterContext, { agentId: "other-agent" }, "new"),
      ).resolves.toBeUndefined();
      await expect(
        getRunReport(adapterContext, target, "missing"),
      ).resolves.toBeUndefined();
      await expect(
        getRunReport(adapterContext, target, "broken-id/"),
      ).rejects.toMatchObject({ code: "invalid" });
    });

    it("ignores a stored run that cannot be read as a report", async () => {
      const adapterContext = context();
      adapterContext.fake.tables.set("eval_runs", [
        {
          run_id: "unreadable",
          agent_id: target.agentId,
          started_at: "not-a-date",
        },
      ]);

      await expect(
        getRunReport(adapterContext, target, "unreadable"),
      ).resolves.toBeUndefined();
    });
  });
});
