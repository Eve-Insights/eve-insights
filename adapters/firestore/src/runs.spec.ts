import type { CreateRunInput } from "@eve-insights/adapter-types";
import type { Firestore } from "@google-cloud/firestore";
import { describe, expect, it } from "vitest";
import { FakeFirestore } from "./fake-firestore.js";
import { firestorePathId, runRef } from "./paths.js";
import { createRun } from "./runs.js";

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
      {
        id: "weather/london",
        description: "Weather",
        tags: ["smoke"],
        timeoutMs: 1000,
      },
    ],
  };
}

function context() {
  const client = new FakeFirestore();
  return {
    client: client as unknown as Firestore,
    fake: client,
    maxChunkBytes: 128,
  };
}

describe("runs", () => {
  it("creates a run and seeds its evaluations", async () => {
    const adapterContext = context();
    const result = await createRun(adapterContext, input());

    expect(result).toEqual({ created: true });
    expect(adapterContext.fake.store.get("evalRuns/run")).toMatchObject({
      status: "running",
      evaluationCount: 1,
      lastEventSequence: -1,
      name: "Weather Agent",
    });
    expect(
      adapterContext.fake.store.get(
        `evalRuns/run/evaluations/${firestorePathId("weather/london")}`,
      ),
    ).toMatchObject({
      status: "pending",
      description: "Weather",
      tags: ["smoke"],
      timeoutMs: 1000,
    });
  });

  it("omits optional evaluation fields when they are absent", async () => {
    const adapterContext = context();
    await createRun(adapterContext, {
      ...input("plain"),
      evaluations: [{ id: "weather/paris" }],
    });

    expect(
      adapterContext.fake.store.get(
        `evalRuns/plain/evaluations/${firestorePathId("weather/paris")}`,
      ),
    ).toEqual({
      id: "weather/paris",
      status: "pending",
    });
  });

  it("makes identical registration replayable and conflicts on changed metadata", async () => {
    const adapterContext = context();
    await createRun(adapterContext, input());

    await expect(createRun(adapterContext, input())).resolves.toEqual({
      created: false,
    });

    const conflicts: Array<Partial<CreateRunInput>> = [
      { startedAt: "2026-08-31T00:00:00.000Z" },
      { target: { ...input().target, agentId: "other" } },
      { target: { ...input().target, url: "http://other" } },
      { target: { ...input().target, kind: "remote" } },
      { target: { ...input().target, name: "Changed Agent" } },
    ];
    for (const patch of conflicts) {
      await expect(
        createRun(adapterContext, { ...input(), ...patch }),
      ).rejects.toMatchObject({ code: "conflict" });
    }
  });

  it("rejects invalid IDs and oversized evaluation lists", async () => {
    const adapterContext = context();
    await expect(
      createRun(adapterContext, { ...input(), runId: "bad/id" }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      createRun(adapterContext, {
        ...input(),
        startedAt: "not-a-date",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      createRun(adapterContext, {
        ...input(),
        target: { ...input().target, name: "" },
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      createRun(adapterContext, {
        ...input(),
        evaluations: [{ id: "" }],
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      createRun(adapterContext, {
        ...input("large"),
        evaluations: Array.from({ length: 10_001 }, (_, index) => ({
          id: `eval-${index}`,
        })),
      }),
    ).rejects.toMatchObject({ code: "too-large" });
  });

  it("heals missing evaluations when the run already exists", async () => {
    const adapterContext = context();
    await createRun(adapterContext, input());
    adapterContext.fake.store.delete(
      `evalRuns/run/evaluations/${firestorePathId("weather/london")}`,
    );

    await expect(createRun(adapterContext, input())).resolves.toEqual({
      created: false,
    });
    expect(
      adapterContext.fake.store.get(
        `evalRuns/run/evaluations/${firestorePathId("weather/london")}`,
      ),
    ).toMatchObject({
      status: "pending",
      description: "Weather",
    });
    expect(runRef(adapterContext.client, "run").path).toBe("evalRuns/run");
  });
});
