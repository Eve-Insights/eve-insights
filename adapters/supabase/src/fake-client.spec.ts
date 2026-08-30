import { describe, expect, it } from "vitest";
import { createFakeSupabaseClient } from "./fake-client.js";

describe("fake Supabase client", () => {
  it("supports filtered reads and single-row reads", async () => {
    const client = createFakeSupabaseClient();

    await client.from("events").insert([
      { run_id: "run-1", event_id: "event-1", status: "staged" },
      { run_id: "run-2", event_id: "event-2", status: "committed" },
    ]);

    await expect(
      client.from("events").select("*").eq("run_id", "run-1").maybeSingle(),
    ).resolves.toEqual({
      data: { run_id: "run-1", event_id: "event-1", status: "staged" },
      error: null,
    });
    await expect(
      client.from("events").select("*").eq("run_id", "missing").maybeSingle(),
    ).resolves.toEqual({ data: null, error: null });
  });

  it("rejects duplicate inserts with a unique violation", async () => {
    const client = createFakeSupabaseClient();
    const row = { run_id: "run-1", event_id: "event-1" };

    await expect(client.from("events").insert(row)).resolves.toEqual({
      data: null,
      error: null,
    });
    await expect(client.from("events").insert(row)).resolves.toEqual({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
  });

  it("rejects a second event that reuses a run sequence", async () => {
    const client = createFakeSupabaseClient();
    await client.from("events").insert({
      run_id: "run-1",
      event_id: "event-1",
      sequence: 0,
    });
    await expect(
      client.from("events").insert({
        run_id: "run-1",
        event_id: "event-2",
        sequence: 0,
      }),
    ).resolves.toEqual({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
  });

  it("pages select results with range()", async () => {
    const client = createFakeSupabaseClient();
    await client
      .from("eval_runs")
      .insert([{ run_id: "run-1" }, { run_id: "run-2" }, { run_id: "run-3" }]);

    await expect(
      client.from("eval_runs").select("*").range(1, 2),
    ).resolves.toEqual({
      data: [{ run_id: "run-2" }, { run_id: "run-3" }],
      error: null,
    });
  });

  it("updates filtered rows and merges upserts", async () => {
    const client = createFakeSupabaseClient();

    await client
      .from("evaluations")
      .insert({ run_id: "run-1", evaluation_id: "eval-1", status: "pending" });
    await client
      .from("evaluations")
      .update({ status: "running" })
      .eq("run_id", "run-1")
      .eq("evaluation_id", "eval-1");
    await client
      .from("evaluations")
      .upsert(
        { run_id: "run-1", evaluation_id: "eval-1", verdict: "passed" },
        { onConflict: "run_id,evaluation_id" },
      );
    await client
      .from("evaluations")
      .upsert({ run_id: "run-1", evaluation_id: "eval-2", status: "pending" });

    await expect(client.from("evaluations").select("*")).resolves.toEqual({
      data: [
        {
          run_id: "run-1",
          evaluation_id: "eval-1",
          status: "running",
          verdict: "passed",
        },
        { run_id: "run-1", evaluation_id: "eval-2", status: "pending" },
      ],
      error: null,
    });
  });
});
