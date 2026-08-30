import type { Firestore } from "@google-cloud/firestore";
import { describe, expect, it } from "vitest";
import { FakeFirestore } from "./fake-firestore.js";
import { firestorePathId } from "./paths.js";
import { getRunReport, listAgents, listRuns } from "./queries.js";
import { emptyCounts } from "./records.js";

const target = {
  agentId: "agent",
  kind: "local" as const,
  url: "http://localhost:3002",
  name: "Weather Agent",
  capabilities: { devRoutes: true },
};

function context() {
  const client = new FakeFirestore();
  return {
    client: client as unknown as Firestore,
    fake: client,
    maxChunkBytes: 128,
  };
}

function putRun(
  fake: FakeFirestore,
  runId: string,
  {
    agentId = "agent",
    startedAt,
    url = target.url,
    name = target.name,
    evaluationIds = [] as readonly string[],
  }: {
    agentId?: string;
    startedAt: string;
    url?: string;
    name?: string;
    evaluationIds?: readonly string[];
  },
): void {
  fake.store.set(`evalRuns/${runId}`, {
    runId,
    agentId,
    startedAt,
    kind: "local",
    url,
    name,
    capabilities: { devRoutes: true },
    status: "running",
    evaluationCount: evaluationIds.length,
    counts: emptyCounts(evaluationIds.length),
    lastEventSequence: -1,
  });
  for (const evaluationId of evaluationIds) {
    fake.store.set(
      `evalRuns/${runId}/evaluations/${firestorePathId(evaluationId)}`,
      { id: evaluationId, status: "pending" },
    );
  }
}

function seed() {
  const adapterContext = context();
  putRun(adapterContext.fake, "old", {
    startedAt: "2026-08-29T00:00:00.000Z",
    evaluationIds: ["weather/zulu"],
  });
  putRun(adapterContext.fake, "new", {
    startedAt: "2026-08-30T00:00:00.000Z",
    evaluationIds: ["weather/zulu", "weather/alpha"],
  });
  putRun(adapterContext.fake, "other", {
    agentId: "other-agent",
    startedAt: "2026-08-31T00:00:00.000Z",
    name: "Other Agent",
  });
  return adapterContext;
}

describe("queries", () => {
  describe("listAgents", () => {
    it("groups agents and uses the newest run snapshot", async () => {
      const adapterContext = context();
      putRun(adapterContext.fake, "new", {
        startedAt: "2026-08-30T00:00:00.000Z",
        evaluationIds: ["weather/zulu", "weather/alpha"],
      });
      putRun(adapterContext.fake, "old", {
        startedAt: "2026-08-29T00:00:00.000Z",
        evaluationIds: ["weather/zulu"],
      });
      putRun(adapterContext.fake, "other", {
        agentId: "other-agent",
        startedAt: "2026-08-31T00:00:00.000Z",
        name: "Other Agent",
      });
      await expect(listAgents(adapterContext)).resolves.toEqual([
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

    it("skips malformed runs and sorts agents by date then url", async () => {
      const adapterContext = context();
      adapterContext.fake.store.set("evalRuns/broken", { runId: "" });
      putRun(adapterContext.fake, "alpha", {
        agentId: "alpha",
        startedAt: "2026-08-30T00:00:00.000Z",
        url: "http://alpha.example",
      });
      putRun(adapterContext.fake, "zeta", {
        agentId: "zeta",
        startedAt: "2026-08-30T00:00:00.000Z",
        url: "http://zeta.example",
      });

      await expect(listAgents(adapterContext)).resolves.toEqual([
        expect.objectContaining({ url: "http://alpha.example" }),
        expect.objectContaining({ url: "http://zeta.example" }),
      ]);
    });
  });

  describe("listRuns", () => {
    it("lists only the selected agent's runs in descending order", async () => {
      const adapterContext = seed();
      adapterContext.fake.store.set("evalRuns/broken", { runId: "" });
      const runs = await listRuns(adapterContext, target);
      expect(runs.map((item) => item.runId)).toEqual(["new", "old"]);
    });

    it("breaks run ties by run id", async () => {
      const adapterContext = context();
      putRun(adapterContext.fake, "b-run", {
        startedAt: "2026-08-30T00:00:00.000Z",
      });
      putRun(adapterContext.fake, "a-run", {
        startedAt: "2026-08-30T00:00:00.000Z",
      });

      const runs = await listRuns(adapterContext, target);
      expect(runs.map((item) => item.runId)).toEqual(["a-run", "b-run"]);
    });
  });

  describe("getRunReport", () => {
    it("loads sorted evaluations and treats another agent as a miss", async () => {
      const adapterContext = seed();
      adapterContext.fake.store.set("evalRuns/new/evaluations/broken", {
        id: "",
      });
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
      adapterContext.fake.store.set("evalRuns/unreadable", {
        runId: "unreadable",
      });
      await expect(
        getRunReport(adapterContext, target, "unreadable"),
      ).resolves.toBeUndefined();
    });
  });
});
