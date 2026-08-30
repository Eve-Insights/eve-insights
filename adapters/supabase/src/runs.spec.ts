import type { CreateRunInput } from "@eve-insights/adapter-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  createFakeSupabaseClient,
  type FakeSupabaseClient,
} from "./fake-client.js";
import { createRun } from "./runs.js";

function input(runId = "run"): CreateRunInput {
  return {
    runId,
    startedAt: "2026-08-30T00:00:00.000Z",
    target: {
      agentId: "11111111-1111-5111-8111-111111111111",
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

describe("runs", () => {
  it("creates a run and seeds its evaluations", async () => {
    const adapterContext = context();

    await expect(createRun(adapterContext, input())).resolves.toEqual({
      created: true,
    });
    expect(adapterContext.fake.tables.get("eval_runs")).toContainEqual(
      expect.objectContaining({
        run_id: "run",
        status: "running",
        evaluation_count: 1,
        last_event_sequence: -1,
        name: "Weather Agent",
      }),
    );
    expect(adapterContext.fake.tables.get("evaluations")).toEqual([
      {
        run_id: "run",
        evaluation_id: "weather/london",
        description: "Weather",
        tags: ["smoke"],
        timeout_ms: 1000,
        status: "pending",
      },
    ]);
  });

  it("omits optional evaluation fields when they are absent", async () => {
    const adapterContext = context();

    await createRun(adapterContext, {
      ...input("plain"),
      evaluations: [{ id: "weather/paris" }],
    });

    expect(adapterContext.fake.tables.get("evaluations")).toEqual([
      {
        run_id: "plain",
        evaluation_id: "weather/paris",
        status: "pending",
      },
    ]);
  });

  it("makes identical registration replayable and conflicts on changed metadata", async () => {
    const adapterContext = context();
    await createRun(adapterContext, input());

    await expect(createRun(adapterContext, input())).resolves.toEqual({
      created: false,
    });
    await expect(
      createRun(adapterContext, {
        ...input(),
        startedAt: "2026-08-31T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      createRun(adapterContext, {
        ...input(),
        target: { ...input().target, agentId: "other-agent" },
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      createRun(adapterContext, {
        ...input(),
        target: { ...input().target, url: "http://other" },
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      createRun(adapterContext, {
        ...input(),
        target: { ...input().target, kind: "remote" },
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      createRun(adapterContext, {
        ...input(),
        target: { ...input().target, name: "Changed Agent" },
      }),
    ).rejects.toMatchObject({ code: "conflict" });
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
    adapterContext.fake.tables.delete("evaluations");

    await expect(createRun(adapterContext, input())).resolves.toEqual({
      created: false,
    });
    expect(adapterContext.fake.tables.get("evaluations")).toEqual([
      expect.objectContaining({
        run_id: "run",
        evaluation_id: "weather/london",
        status: "pending",
      }),
    ]);
  });
});
