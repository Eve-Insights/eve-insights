import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./store.js";

const run = {
  runId: "run",
  agentId: "agent",
  startedAt: "2026-08-30T00:00:00.000Z",
  status: "running",
};

describe("MemoryAdapterStore", () => {
  it("inserts, reads, filters, and updates records", async () => {
    const store = createMemoryStore();
    await store.insertRun(run);
    await store.insertEvaluation({
      runId: "run",
      id: "eval",
      status: "pending",
    });
    await store.insertEvent({
      runId: "run",
      eventId: "event",
      status: "staged",
    });
    await store.insertChunk({
      runId: "run",
      eventId: "event",
      index: 0,
      data: "YQ==",
    });
    await store.upsertSession({
      runId: "run",
      sessionId: "session",
      evaluationId: "eval",
    });

    expect(await store.getRun("run")).toEqual(run);
    expect(await store.listRuns("agent")).toHaveLength(1);
    expect(await store.getEvaluation("run", "eval")).toMatchObject({
      status: "pending",
    });
    expect(await store.listEvaluations("run")).toHaveLength(1);
    expect(await store.getEvent("run", "event")).toMatchObject({
      status: "staged",
    });
    expect(await store.getChunk("run", "event", 0)).toMatchObject({
      data: "YQ==",
    });
    expect(await store.listChunks("run", "event")).toHaveLength(1);

    await store.updateRun("run", { status: "completed" });
    await store.updateEvaluation("run", "eval", { status: "completed" });
    await store.updateEvent("run", "event", { status: "committed" });
    await store.insertEvent({
      runId: "run",
      eventId: "event-2",
      status: "staged",
    });
    expect(
      await store.markEventCommitted(
        "run",
        "event-2",
        "2026-08-30T00:00:00.000Z",
      ),
    ).toBe(true);
    expect(
      await store.markEventCommitted(
        "run",
        "event-2",
        "2026-08-30T00:00:00.000Z",
      ),
    ).toBe(false);
    expect(await store.getRun("run")).toMatchObject({ status: "completed" });
    expect(await store.getEvaluation("run", "eval")).toMatchObject({
      status: "completed",
    });
    expect(await store.getEvent("run", "event")).toMatchObject({
      status: "committed",
    });
  });

  it("rejects duplicate keys", async () => {
    const store = createMemoryStore();
    await store.insertRun(run);
    await expect(store.insertRun(run)).rejects.toMatchObject({
      code: "conflict",
    });
    await store.insertEvent({ runId: "run", eventId: "event" });
    await expect(
      store.insertEvent({ runId: "run", eventId: "event" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("commits a transaction and rolls it back after an error", async () => {
    const store = createMemoryStore();
    await store.transaction(async (transaction) => {
      await transaction.insertRun(run);
    });
    expect(await store.getRun("run")).toEqual(run);

    await expect(
      store.transaction(async (transaction) => {
        await transaction.updateRun("run", { status: "completed" });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await store.getRun("run")).toMatchObject({ status: "running" });
  });
});
