import type { CreateRunInput } from "@eve-insights/adapter-types";
import { describe, expect, it } from "vitest";
import { createRun } from "./runs.js";
import { createMemoryStore } from "./store.js";

function input(runId = "run"): CreateRunInput {
  return {
    runId,
    startedAt: "2026-08-30T00:00:00.000Z",
    target: {
      agentId: "agent",
      kind: "local",
      url: "http://localhost:3002",
      name: "Weather Agent",
      capabilities: { devRoutes: true },
    },
    evaluations: [
      { id: "weather/london", description: "Weather", tags: ["smoke"] },
    ],
  };
}

describe("createRun", () => {
  it("creates a run and seeds its evaluations atomically", async () => {
    const store = createMemoryStore();
    const result = await createRun({ store, maxChunkBytes: 128 }, input());

    expect(result).toEqual({ created: true });
    expect(await store.getRun("run")).toMatchObject({
      status: "running",
      evaluationCount: 1,
      lastEventSequence: -1,
    });
    expect(await store.getEvaluation("run", "weather/london")).toMatchObject({
      status: "pending",
      description: "Weather",
    });
  });

  it("makes identical registration replayable and conflicts on changed metadata", async () => {
    const store = createMemoryStore();
    await createRun({ store, maxChunkBytes: 128 }, input());

    await expect(
      createRun({ store, maxChunkBytes: 128 }, input()),
    ).resolves.toEqual({ created: false });
    await expect(
      createRun(
        { store, maxChunkBytes: 128 },
        { ...input(), target: { ...input().target, name: "Changed Agent" } },
      ),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("heals missing evaluations when the run already exists", async () => {
    const store = createMemoryStore();
    await createRun({ store, maxChunkBytes: 128 }, input());
    await store.deleteEvaluationsForRun("run");

    await expect(
      createRun({ store, maxChunkBytes: 128 }, input()),
    ).resolves.toEqual({ created: false });
    expect(await store.getEvaluation("run", "weather/london")).toMatchObject({
      status: "pending",
      description: "Weather",
    });
  });

  it("rejects invalid IDs and oversized evaluation lists", async () => {
    const store = createMemoryStore();
    await expect(
      createRun({ store, maxChunkBytes: 128 }, { ...input(), runId: "bad/id" }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      createRun(
        { store, maxChunkBytes: 128 },
        {
          ...input("large"),
          evaluations: Array.from({ length: 10_001 }, (_, index) => ({
            id: `eval-${index}`,
          })),
        },
      ),
    ).rejects.toMatchObject({ code: "too-large" });
  });
});
