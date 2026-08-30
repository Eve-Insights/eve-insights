import { describe, expect, it } from "vitest";
import { getRunReport, listAgents, listRuns } from "./queries.js";
import { createRun } from "./runs.js";
import { createMemoryStore } from "./store.js";

const target = {
  agentId: "agent",
  kind: "local" as const,
  url: "http://localhost:3002",
  name: "Weather Agent",
  capabilities: { devRoutes: true },
};

async function seed() {
  const store = createMemoryStore();
  await createRun(
    { store, maxChunkBytes: 128 },
    {
      runId: "old",
      startedAt: "2026-08-29T00:00:00.000Z",
      target,
      evaluations: [{ id: "weather/zulu" }],
    },
  );
  await createRun(
    { store, maxChunkBytes: 128 },
    {
      runId: "new",
      startedAt: "2026-08-30T00:00:00.000Z",
      target,
      evaluations: [{ id: "weather/zulu" }, { id: "weather/alpha" }],
    },
  );
  await createRun(
    { store, maxChunkBytes: 128 },
    {
      runId: "other",
      startedAt: "2026-08-31T00:00:00.000Z",
      target: { ...target, agentId: "other-agent", name: "Other Agent" },
      evaluations: [],
    },
  );
  return store;
}

describe("database queries", () => {
  it("groups agents and uses the newest run snapshot", async () => {
    const store = await seed();
    await expect(listAgents({ store, maxChunkBytes: 128 })).resolves.toEqual([
      expect.objectContaining({
        agentId: "other-agent",
        runCount: 1,
        evaluationCount: 0,
      }),
      expect.objectContaining({
        agentId: "agent",
        runCount: 2,
        evaluationCount: 3,
        lastRunStartedAt: "2026-08-30T00:00:00.000Z",
      }),
    ]);
  });

  it("lists only the selected agent's runs in descending order", async () => {
    const store = await seed();
    const runs = await listRuns({ store, maxChunkBytes: 128 }, target);
    expect(runs.map((run) => run.runId)).toEqual(["new", "old"]);
  });

  it("loads sorted evaluations and treats another agent as a miss", async () => {
    const store = await seed();
    await expect(
      getRunReport({ store, maxChunkBytes: 128 }, target, "new"),
    ).resolves.toMatchObject({
      run: { runId: "new" },
      evaluations: [{ id: "weather/alpha" }, { id: "weather/zulu" }],
    });
    await expect(
      getRunReport(
        { store, maxChunkBytes: 128 },
        { agentId: "other-agent" },
        "new",
      ),
    ).resolves.toBeUndefined();
    await expect(
      getRunReport({ store, maxChunkBytes: 128 }, target, "missing"),
    ).resolves.toBeUndefined();
  });
});
