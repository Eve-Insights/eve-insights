import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type {
  BeginEventInput,
  CreateRunInput,
  DatabaseAdapter,
  EventProjection,
} from "./index.js";

export interface DatabaseAdapterContractHarness {
  readonly adapter: DatabaseAdapter;
  dropEvaluations(runId: string): Promise<void>;
}

const startedAt = "2026-08-30T00:00:00.000Z";
const agentId = "agent";

function runInput(runId: string): CreateRunInput {
  return {
    runId,
    startedAt,
    target: {
      agentId,
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

function eventInput(
  runId: string,
  eventId: string,
  sequence: number,
  bytes: Buffer,
  projection: EventProjection,
): BeginEventInput {
  return {
    runId,
    eventId,
    sequence,
    type: "eval.started",
    occurredAt: startedAt,
    projection,
    payload: {
      encoding: "gzip",
      contentType: "application/json",
      byteLength: bytes.length,
      chunkSize: 128,
      chunkCount: 1,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
}

async function stageEvent(
  adapter: DatabaseAdapter,
  input: BeginEventInput,
  bytes: Buffer,
): Promise<void> {
  await adapter.beginEvent(input);
  await adapter.writeEventChunk({
    runId: input.runId,
    eventId: input.eventId,
    index: 0,
    data: bytes.toString("base64"),
  });
}

/**
 * Shared `DatabaseAdapter` cases every adapter must pass: replay,
 * torn-create heal, concurrent begin/commit, checksum, and sequence CAS.
 */
export function defineDatabaseAdapterContract(
  createHarness: () =>
    | DatabaseAdapterContractHarness
    | Promise<DatabaseAdapterContractHarness>,
): void {
  describe("DatabaseAdapter contract", () => {
    it("replays identical writes and conflicts on changed metadata", async () => {
      const { adapter } = await createHarness();
      const input = runInput("replay-run");
      const bytes = Buffer.from("payload");
      const event = eventInput("replay-run", "event", 0, bytes, {
        evaluation: { id: "weather/london", status: "running" },
      });

      await expect(adapter.createRun(input)).resolves.toEqual({
        created: true,
      });
      await expect(adapter.createRun(input)).resolves.toEqual({
        created: false,
      });
      await expect(
        adapter.createRun({
          ...input,
          target: { ...input.target, name: "Changed Agent" },
        }),
      ).rejects.toMatchObject({ code: "conflict" });

      await expect(adapter.beginEvent(event)).resolves.toEqual({
        created: true,
      });
      await expect(adapter.beginEvent(event)).resolves.toEqual({
        created: false,
      });
      await expect(
        adapter.beginEvent({ ...event, type: "eval.completed" }),
      ).rejects.toMatchObject({ code: "conflict" });

      const chunk = {
        runId: event.runId,
        eventId: event.eventId,
        index: 0,
        data: bytes.toString("base64"),
      };
      await expect(adapter.writeEventChunk(chunk)).resolves.toEqual({
        created: true,
      });
      await expect(adapter.writeEventChunk(chunk)).resolves.toEqual({
        created: false,
      });

      await expect(
        adapter.commitEvent({
          runId: event.runId,
          eventId: event.eventId,
        }),
      ).resolves.toEqual({ committed: true });
      await expect(
        adapter.commitEvent({
          runId: event.runId,
          eventId: event.eventId,
        }),
      ).resolves.toEqual({ committed: false });
    });

    it("heals a torn createRun that left evaluations missing", async () => {
      const harness = await createHarness();
      const input = runInput("torn-run");
      await harness.adapter.createRun(input);
      await harness.dropEvaluations(input.runId);

      const torn = await harness.adapter.getRunReport({ agentId }, input.runId);
      expect(torn?.evaluations).toEqual([]);

      await expect(harness.adapter.createRun(input)).resolves.toEqual({
        created: false,
      });
      const healed = await harness.adapter.getRunReport(
        { agentId },
        input.runId,
      );
      expect(healed?.evaluations.map((evaluation) => evaluation.id)).toEqual([
        "weather/london",
      ]);
    });

    it("rejects concurrent begins that disagree on metadata", async () => {
      const { adapter } = await createHarness();
      const input = runInput("begin-run");
      const bytes = Buffer.from("payload");
      await adapter.createRun(input);
      const left = eventInput("begin-run", "shared", 0, bytes, {
        evaluation: { id: "weather/london", status: "running" },
      });
      const right = { ...left, type: "eval.completed" as const };

      const outcomes = await Promise.allSettled([
        adapter.beginEvent(left),
        adapter.beginEvent(right),
      ]);
      const fulfilled = outcomes.filter(
        (outcome) => outcome.status === "fulfilled",
      );
      const rejected = outcomes.filter(
        (outcome) => outcome.status === "rejected",
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(
        rejected[0]?.status === "rejected" && rejected[0].reason,
      ).toMatchObject({ code: "conflict" });
    });

    it("rejects a second event that reuses a sequence", async () => {
      const { adapter } = await createHarness();
      const bytes = Buffer.from("payload");
      await adapter.createRun(runInput("sequence-run"));
      await adapter.beginEvent(
        eventInput("sequence-run", "first", 0, bytes, {}),
      );
      await expect(
        adapter.beginEvent(eventInput("sequence-run", "second", 0, bytes, {})),
      ).rejects.toMatchObject({ code: "conflict" });
    });

    it("treats a concurrent second commit as already finalized", async () => {
      const { adapter } = await createHarness();
      const bytes = Buffer.from("payload");
      const event = eventInput("commit-run", "event", 0, bytes, {
        evaluation: { id: "weather/london", status: "running" },
      });
      await adapter.createRun(runInput("commit-run"));
      await stageEvent(adapter, event, bytes);

      const outcomes = await Promise.all([
        adapter.commitEvent({
          runId: event.runId,
          eventId: event.eventId,
        }),
        adapter.commitEvent({
          runId: event.runId,
          eventId: event.eventId,
        }),
      ]);
      expect(outcomes.filter((result) => result.committed)).toHaveLength(1);
      expect(outcomes.filter((result) => !result.committed)).toHaveLength(1);
    });

    it("rejects a commit whose chunks fail the payload checksum", async () => {
      const { adapter } = await createHarness();
      const bytes = Buffer.from("abc");
      const event = eventInput("checksum-run", "event", 0, bytes, {});
      await adapter.createRun(runInput("checksum-run"));
      await adapter.beginEvent(event);
      await adapter.writeEventChunk({
        runId: event.runId,
        eventId: event.eventId,
        index: 0,
        data: Buffer.from("xyz").toString("base64"),
      });
      await expect(
        adapter.commitEvent({
          runId: event.runId,
          eventId: event.eventId,
        }),
      ).rejects.toMatchObject({ code: "conflict" });
    });

    it("ignores an older projection after a newer sequence committed", async () => {
      const { adapter } = await createHarness();
      const bytes = Buffer.from("payload");
      await adapter.createRun(runInput("cas-run"));

      const newer = eventInput("cas-run", "newer", 1, bytes, {
        run: {
          status: "completed",
          completedAt: startedAt,
          counts: {
            total: 1,
            passed: 1,
            failed: 0,
            scored: 0,
            skipped: 0,
            errored: 0,
          },
        },
      });
      const older = eventInput("cas-run", "older", 0, bytes, {
        run: { status: "running" },
      });
      await stageEvent(adapter, newer, bytes);
      await adapter.commitEvent({
        runId: newer.runId,
        eventId: newer.eventId,
      });
      await stageEvent(adapter, older, bytes);
      await adapter.commitEvent({
        runId: older.runId,
        eventId: older.eventId,
      });

      const report = await adapter.getRunReport({ agentId }, "cas-run");
      expect(report?.run).toMatchObject({
        status: "completed",
        lastEventSequence: 1,
      });
    });
  });
}
