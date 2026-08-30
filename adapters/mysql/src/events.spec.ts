import { createHash } from "node:crypto";
import type {
  BeginEventInput,
  CreateRunInput,
} from "@eve-insights/adapter-types";
import { describe, expect, it } from "vitest";
import { beginEvent, commitEvent, writeEventChunk } from "./events.js";
import { createRun } from "./runs.js";
import { createMemoryStore } from "./store.js";

const run: CreateRunInput = {
  runId: "run",
  startedAt: "2026-08-30T00:00:00.000Z",
  target: {
    agentId: "agent",
    kind: "local",
    url: "http://localhost:3002",
    name: "Weather Agent",
    capabilities: { devRoutes: true },
  },
  evaluations: [{ id: "weather/london" }],
};

function event(
  eventId: string,
  bytes = Buffer.from("payload"),
  projection: BeginEventInput["projection"] = {
    evaluation: {
      id: "weather/london",
      status: "running",
    },
  },
): BeginEventInput {
  return {
    runId: run.runId,
    eventId,
    sequence: 0,
    type: "eval.started",
    occurredAt: run.startedAt,
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

async function context() {
  const store = createMemoryStore();
  await createRun({ store, maxChunkBytes: 128 }, run);
  return { store, maxChunkBytes: 128 };
}

describe("event persistence", () => {
  it("stages, chunks, and commits an event idempotently", async () => {
    const adapterContext = await context();
    const input = event("event");
    const bytes = Buffer.from("payload");

    await expect(beginEvent(adapterContext, input)).resolves.toEqual({
      created: true,
    });
    await expect(beginEvent(adapterContext, input)).resolves.toEqual({
      created: false,
    });
    await expect(
      beginEvent(adapterContext, { ...input, sequence: 1 }),
    ).rejects.toMatchObject({ code: "conflict" });

    const chunk = {
      runId: run.runId,
      eventId: input.eventId,
      index: 0,
      data: bytes.toString("base64"),
    };
    await expect(writeEventChunk(adapterContext, chunk)).resolves.toEqual({
      created: true,
    });
    await expect(writeEventChunk(adapterContext, chunk)).resolves.toEqual({
      created: false,
    });
    await expect(
      writeEventChunk(adapterContext, { ...chunk, data: "eA==" }),
    ).rejects.toMatchObject({ code: "conflict" });

    await expect(
      commitEvent(adapterContext, {
        runId: run.runId,
        eventId: input.eventId,
      }),
    ).resolves.toEqual({ committed: true });
    await expect(
      commitEvent(adapterContext, {
        runId: run.runId,
        eventId: input.eventId,
      }),
    ).resolves.toEqual({ committed: false });
  });

  it("merges run, evaluation, and session projections on commit", async () => {
    const adapterContext = await context();
    const input = event("projected-event", Buffer.from("payload"), {
      run: {
        status: "completed",
        completedAt: run.startedAt,
        counts: {
          total: 1,
          passed: 1,
          failed: 0,
          scored: 0,
          skipped: 0,
          errored: 0,
        },
      },
      evaluation: {
        id: "weather/london",
        status: "completed",
        verdict: "passed",
        assertionCount: 1,
        passedAssertionCount: 1,
        failedAssertionCount: 0,
      },
      session: {
        evaluationId: "weather/london",
        sessionId: "session",
        primary: true,
        startedAt: run.startedAt,
      },
    });
    await beginEvent(adapterContext, input);
    await writeEventChunk(adapterContext, {
      runId: run.runId,
      eventId: input.eventId,
      index: 0,
      data: Buffer.from("payload").toString("base64"),
    });

    await commitEvent(adapterContext, {
      runId: run.runId,
      eventId: input.eventId,
    });
    expect(await adapterContext.store.getRun(run.runId)).toMatchObject({
      status: "completed",
      lastEventSequence: 0,
    });
    expect(
      await adapterContext.store.getEvaluation(run.runId, "weather/london"),
    ).toMatchObject({ status: "completed", verdict: "passed" });
  });

  it("rejects missing events, incomplete chunks, empty middle chunks, and bad checksums", async () => {
    const adapterContext = await context();
    await expect(
      commitEvent(adapterContext, { runId: run.runId, eventId: "missing" }),
    ).rejects.toMatchObject({ code: "not-found" });
    await expect(
      beginEvent(adapterContext, { ...event("invalid"), sequence: -1 }),
    ).rejects.toMatchObject({ code: "invalid" });

    const incomplete = event("incomplete", Buffer.alloc(129));
    await beginEvent(adapterContext, {
      ...incomplete,
      payload: { ...incomplete.payload, chunkCount: 2 },
    });
    await expect(
      writeEventChunk(adapterContext, {
        runId: run.runId,
        eventId: "incomplete",
        index: 0,
        data: "",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      writeEventChunk(adapterContext, {
        runId: run.runId,
        eventId: "incomplete",
        index: 0,
        data: Buffer.alloc(129).toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "too-large" });
    await expect(
      commitEvent(adapterContext, { runId: run.runId, eventId: "incomplete" }),
    ).rejects.toMatchObject({ code: "incomplete" });

    const badChecksum = event("bad-checksum", Buffer.from("abc"));
    await beginEvent(adapterContext, { ...badChecksum, sequence: 1 });
    await writeEventChunk(adapterContext, {
      runId: run.runId,
      eventId: "bad-checksum",
      index: 0,
      data: Buffer.from("xyz").toString("base64"),
    });
    await expect(
      commitEvent(adapterContext, {
        runId: run.runId,
        eventId: "bad-checksum",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});
