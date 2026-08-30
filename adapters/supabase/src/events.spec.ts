import { createHash } from "node:crypto";
import type {
  BeginEventInput,
  CreateRunInput,
} from "@eve-insights/adapter-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { beginEvent, commitEvent, writeEventChunk } from "./events.js";
import {
  createFakeSupabaseClient,
  type FakeSupabaseClient,
} from "./fake-client.js";
import { createRun } from "./runs.js";

const run: CreateRunInput = {
  runId: "run",
  startedAt: "2026-08-30T00:00:00.000Z",
  target: {
    agentId: "11111111-1111-5111-8111-111111111111",
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
  chunkCount = 1,
  chunkSize = 128,
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
      chunkSize,
      chunkCount,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
}

async function context(): Promise<{
  client: SupabaseClient;
  fake: FakeSupabaseClient;
  maxChunkBytes: number;
}> {
  const fake = createFakeSupabaseClient();
  const adapterContext = {
    client: fake as unknown as SupabaseClient,
    fake,
    maxChunkBytes: 128,
  };
  await createRun(adapterContext, run);
  return adapterContext;
}

function row(
  fake: FakeSupabaseClient,
  table: string,
  predicate: (value: Record<string, unknown>) => boolean,
): Record<string, unknown> {
  const found = fake.tables.get(table)?.find((value) => predicate(value));
  if (found === undefined) throw new Error(`No row found in ${table}.`);
  return found;
}

describe("events", () => {
  it("stages, chunks, and commits an event idempotently", async () => {
    const adapterContext = await context();
    const input = event("event");
    const bytes = Buffer.from("payload");
    const chunk = {
      runId: run.runId,
      eventId: input.eventId,
      index: 0,
      data: bytes.toString("base64"),
    };

    await expect(beginEvent(adapterContext, input)).resolves.toEqual({
      created: true,
    });
    await expect(beginEvent(adapterContext, input)).resolves.toEqual({
      created: false,
    });
    await expect(
      beginEvent(adapterContext, { ...input, sequence: 1 }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      beginEvent(adapterContext, { ...event("other"), sequence: 0 }),
    ).rejects.toMatchObject({ code: "conflict" });
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
    expect(
      row(adapterContext.fake, "events", (value) => value.event_id === "event"),
    ).toMatchObject({ status: "committed" });
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
        startedAt: run.startedAt,
        completedAt: run.startedAt,
        verdict: "passed",
        error: "none",
        skipReason: "n/a",
        assertionCount: 1,
        passedAssertionCount: 1,
        failedAssertionCount: 0,
      },
      session: {
        evaluationId: "weather/london",
        sessionId: "session",
        primary: true,
        startedAt: run.startedAt,
        traceContext: { traceId: "abc" },
      },
    });
    await beginEvent(adapterContext, input);
    await writeEventChunk(adapterContext, {
      runId: run.runId,
      eventId: input.eventId,
      index: 0,
      data: Buffer.from("payload").toString("base64"),
    });

    await expect(
      commitEvent(adapterContext, {
        runId: run.runId,
        eventId: input.eventId,
      }),
    ).resolves.toEqual({ committed: true });
    expect(
      row(
        adapterContext.fake,
        "eval_runs",
        (value) => value.run_id === run.runId,
      ),
    ).toMatchObject({
      status: "completed",
      completed_at: run.startedAt,
      last_event_sequence: 0,
      counts: { total: 1, passed: 1 },
    });
    expect(
      row(
        adapterContext.fake,
        "evaluations",
        (value) => value.evaluation_id === "weather/london",
      ),
    ).toMatchObject({
      status: "completed",
      verdict: "passed",
      started_at: run.startedAt,
      completed_at: run.startedAt,
      error: "none",
      skip_reason: "n/a",
    });
    expect(
      row(
        adapterContext.fake,
        "sessions",
        (value) => value.session_id === "session",
      ),
    ).toEqual({
      run_id: run.runId,
      session_id: "session",
      evaluation_id: "weather/london",
      is_primary: true,
      started_at: run.startedAt,
      trace_context: { traceId: "abc" },
    });
  });

  it("commits sequence-only projections and defaults a missing stored sequence", async () => {
    const adapterContext = await context();
    const storedRun = row(
      adapterContext.fake,
      "eval_runs",
      (value) => value.run_id === run.runId,
    );
    delete storedRun.last_event_sequence;
    const input = event("sequence-only", Buffer.from("payload"), {});
    await beginEvent(adapterContext, { ...input, sequence: 3 });
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
    expect(storedRun).toMatchObject({
      status: "running",
      last_event_sequence: 3,
    });
  });

  it("accepts an empty final chunk and keeps a higher stored sequence", async () => {
    const adapterContext = await context();
    const storedRun = row(
      adapterContext.fake,
      "eval_runs",
      (value) => value.run_id === run.runId,
    );
    storedRun.last_event_sequence = 9;
    const input = event(
      "empty-final",
      Buffer.alloc(0),
      {
        run: { status: "completed" },
        session: {
          evaluationId: "weather/london",
          sessionId: "session-2",
          primary: false,
          startedAt: run.startedAt,
        },
      },
      1,
    );
    await beginEvent(adapterContext, input);
    await expect(
      writeEventChunk(adapterContext, {
        runId: run.runId,
        eventId: input.eventId,
        index: 0,
        data: "",
      }),
    ).resolves.toEqual({ created: true });
    await commitEvent(adapterContext, {
      runId: run.runId,
      eventId: input.eventId,
    });

    expect(storedRun).toMatchObject({
      status: "running",
      last_event_sequence: 9,
    });
    expect(
      adapterContext.fake.tables
        .get("sessions")
        ?.find((value) => value.session_id === "session-2"),
    ).toBeUndefined();
  });

  it("rejects invalid identifiers and payload metadata", async () => {
    const adapterContext = await context();
    await expect(
      beginEvent(adapterContext, { ...event("invalid"), sequence: -1 }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      beginEvent(adapterContext, { ...event("invalid"), sequence: 1.5 }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      beginEvent(adapterContext, {
        ...event("invalid"),
        runId: "",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      beginEvent(adapterContext, {
        ...event("invalid"),
        eventId: "",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      beginEvent(adapterContext, {
        ...event("invalid"),
        occurredAt: "not-a-date",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      beginEvent(adapterContext, {
        ...event("invalid"),
        payload: { ...event("invalid").payload, sha256: "bad" },
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      writeEventChunk(adapterContext, {
        runId: "",
        eventId: "event",
        index: 0,
        data: "YQ==",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      writeEventChunk(adapterContext, {
        runId: run.runId,
        eventId: "",
        index: 0,
        data: "YQ==",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      writeEventChunk(adapterContext, {
        runId: run.runId,
        eventId: "event",
        index: -1,
        data: "YQ==",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      writeEventChunk(adapterContext, {
        runId: run.runId,
        eventId: "event",
        index: 1.5,
        data: "YQ==",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      commitEvent(adapterContext, { runId: "", eventId: "event" }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      commitEvent(adapterContext, { runId: run.runId, eventId: "" }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects missing events, incomplete chunks, empty middle chunks, and bad checksums", async () => {
    const adapterContext = await context();
    await expect(
      beginEvent(adapterContext, { ...event("missing-run"), runId: "missing" }),
    ).rejects.toMatchObject({ code: "not-found" });
    await expect(
      commitEvent(adapterContext, { runId: run.runId, eventId: "missing" }),
    ).rejects.toMatchObject({ code: "not-found" });
    await expect(
      writeEventChunk(adapterContext, {
        runId: run.runId,
        eventId: "missing",
        index: 0,
        data: "YQ==",
      }),
    ).rejects.toMatchObject({ code: "not-found" });

    const incomplete = event("incomplete", Buffer.from("abc"), {}, 2, 2);
    await beginEvent(adapterContext, incomplete);
    await expect(
      writeEventChunk(adapterContext, {
        runId: run.runId,
        eventId: incomplete.eventId,
        index: 0,
        data: "",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      writeEventChunk(adapterContext, {
        runId: run.runId,
        eventId: incomplete.eventId,
        index: 2,
        data: Buffer.from("ab").toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      writeEventChunk(adapterContext, {
        runId: run.runId,
        eventId: incomplete.eventId,
        index: 0,
        data: Buffer.from("abcd").toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "too-large" });
    await expect(
      writeEventChunk(adapterContext, {
        runId: run.runId,
        eventId: incomplete.eventId,
        index: 0,
        data: "not base64",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      commitEvent(adapterContext, {
        runId: run.runId,
        eventId: incomplete.eventId,
      }),
    ).rejects.toMatchObject({ code: "incomplete" });

    const gap = event("gap", Buffer.from("abcdef"), {}, 2, 3);
    await beginEvent(adapterContext, { ...gap, sequence: 1 });
    await writeEventChunk(adapterContext, {
      runId: run.runId,
      eventId: gap.eventId,
      index: 1,
      data: Buffer.from("def").toString("base64"),
    });
    await expect(
      commitEvent(adapterContext, { runId: run.runId, eventId: gap.eventId }),
    ).rejects.toMatchObject({ code: "incomplete" });

    const badChecksum = event("bad-checksum", Buffer.from("abc"));
    await beginEvent(adapterContext, { ...badChecksum, sequence: 2 });
    await writeEventChunk(adapterContext, {
      runId: run.runId,
      eventId: badChecksum.eventId,
      index: 0,
      data: Buffer.from("xyz").toString("base64"),
    });
    await expect(
      commitEvent(adapterContext, {
        runId: run.runId,
        eventId: badChecksum.eventId,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects a commit when the run disappears before projection updates", async () => {
    const adapterContext = await context();
    const input = event("orphan");
    await beginEvent(adapterContext, input);
    await writeEventChunk(adapterContext, {
      runId: run.runId,
      eventId: input.eventId,
      index: 0,
      data: Buffer.from("payload").toString("base64"),
    });
    adapterContext.fake.tables.delete("eval_runs");

    await expect(
      commitEvent(adapterContext, {
        runId: run.runId,
        eventId: input.eventId,
      }),
    ).rejects.toMatchObject({ code: "not-found" });
  });
});
