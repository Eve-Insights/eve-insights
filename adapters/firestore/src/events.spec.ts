import { createHash } from "node:crypto";
import type { BeginEventInput } from "@eve-insights/adapter-types";
import type { Firestore } from "@google-cloud/firestore";
import { describe, expect, it } from "vitest";
import { beginEvent, commitEvent, writeEventChunk } from "./events.js";
import { FakeFirestore } from "./fake-firestore.js";
import { firestorePathId } from "./paths.js";

const runId = "run";
const startedAt = "2026-08-30T00:00:00.000Z";

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
): BeginEventInput {
  return {
    runId,
    eventId,
    sequence: 0,
    type: "eval.started",
    occurredAt: startedAt,
    projection,
    payload: {
      encoding: "gzip",
      contentType: "application/json",
      byteLength: bytes.length,
      chunkSize: 128,
      chunkCount,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
}

function context() {
  const client = new FakeFirestore();
  client.store.set(`evalRuns/${runId}`, {
    runId,
    agentId: "agent",
    startedAt,
    kind: "local",
    url: "http://localhost:3002",
    name: "Weather Agent",
    capabilities: { devRoutes: true },
    status: "running",
    evaluationCount: 1,
    counts: {
      total: 1,
      passed: 0,
      failed: 0,
      scored: 0,
      skipped: 0,
      errored: 0,
    },
    lastEventSequence: -1,
  });
  client.store.set(
    `evalRuns/${runId}/evaluations/${firestorePathId("weather/london")}`,
    { id: "weather/london", status: "pending" },
  );
  return {
    client: client as unknown as Firestore,
    fake: client,
    maxChunkBytes: 128,
  };
}

describe("events", () => {
  it("stages, chunks, and commits an event idempotently", async () => {
    const adapterContext = context();
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
    await expect(
      beginEvent(adapterContext, { ...event("other"), sequence: 0 }),
    ).rejects.toMatchObject({ code: "conflict" });

    const chunk = {
      runId: runId,
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
        runId: runId,
        eventId: input.eventId,
      }),
    ).resolves.toEqual({ committed: true });
    await expect(
      commitEvent(adapterContext, {
        runId: runId,
        eventId: input.eventId,
      }),
    ).resolves.toEqual({ committed: false });
  });

  it("merges run, evaluation, and session projections on commit", async () => {
    const adapterContext = context();
    const input = event("projected-event", Buffer.from("payload"), {
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
      evaluation: {
        id: "weather/london",
        status: "completed",
        startedAt: startedAt,
        completedAt: startedAt,
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
        startedAt: startedAt,
        traceContext: { traceId: "abc" },
      },
    });
    await beginEvent(adapterContext, input);
    await writeEventChunk(adapterContext, {
      runId: runId,
      eventId: input.eventId,
      index: 0,
      data: Buffer.from("payload").toString("base64"),
    });

    await commitEvent(adapterContext, {
      runId: runId,
      eventId: input.eventId,
    });
    expect(adapterContext.fake.store.get("evalRuns/run")).toMatchObject({
      status: "completed",
      completedAt: startedAt,
      lastEventSequence: 0,
      counts: { total: 1, passed: 1 },
    });
    expect(
      adapterContext.fake.store.get(
        `evalRuns/run/evaluations/${firestorePathId("weather/london")}`,
      ),
    ).toMatchObject({
      status: "completed",
      verdict: "passed",
      startedAt: startedAt,
      completedAt: startedAt,
      error: "none",
      skipReason: "n/a",
    });
    expect(
      adapterContext.fake.store.get(
        `evalRuns/run/sessions/${firestorePathId("session")}`,
      ),
    ).toMatchObject({
      sessionId: "session",
      primary: true,
      traceContext: { traceId: "abc" },
    });

    const withoutTrace = event("session-plain", Buffer.from("payload"), {
      session: {
        evaluationId: "weather/london",
        sessionId: "session-plain",
        primary: false,
        startedAt: startedAt,
      },
    });
    await beginEvent(adapterContext, { ...withoutTrace, sequence: 1 });
    await writeEventChunk(adapterContext, {
      runId: runId,
      eventId: withoutTrace.eventId,
      index: 0,
      data: Buffer.from("payload").toString("base64"),
    });
    await commitEvent(adapterContext, {
      runId: runId,
      eventId: withoutTrace.eventId,
    });
    expect(
      adapterContext.fake.store.get(
        `evalRuns/run/sessions/${firestorePathId("session-plain")}`,
      ),
    ).toEqual({
      runId,
      evaluationId: "weather/london",
      sessionId: "session-plain",
      primary: false,
      startedAt,
    });
  });

  it("commits a projection that only updates the run sequence", async () => {
    const adapterContext = context();
    const input = event("sequence-only", Buffer.from("payload"), {});
    await beginEvent(adapterContext, { ...input, sequence: 3 });
    await writeEventChunk(adapterContext, {
      runId: runId,
      eventId: input.eventId,
      index: 0,
      data: Buffer.from("payload").toString("base64"),
    });

    await commitEvent(adapterContext, {
      runId: runId,
      eventId: input.eventId,
    });
    expect(adapterContext.fake.store.get("evalRuns/run")).toMatchObject({
      status: "running",
      lastEventSequence: 3,
    });
    expect(
      adapterContext.fake.store.get(
        `evalRuns/run/evaluations/${firestorePathId("weather/london")}`,
      ),
    ).toMatchObject({ status: "pending" });
  });

  it("rejects invalid identifiers and payload metadata", async () => {
    const adapterContext = context();
    await expect(
      beginEvent(adapterContext, { ...event("event"), runId: "" }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      beginEvent(adapterContext, { ...event("event"), eventId: "" }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      beginEvent(adapterContext, {
        ...event("event"),
        occurredAt: "not-a-date",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      beginEvent(adapterContext, {
        ...event("event"),
        payload: { ...event("event").payload, sha256: "bad" },
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
        runId: runId,
        eventId: "",
        index: 0,
        data: "YQ==",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      commitEvent(adapterContext, { runId: "", eventId: "event" }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      commitEvent(adapterContext, { runId: runId, eventId: "" }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("defaults a missing last event sequence to -1", async () => {
    const adapterContext = context();
    const stored = adapterContext.fake.store.get("evalRuns/run");
    const { lastEventSequence: _lastEventSequence, ...withoutSequence } =
      stored ?? {};
    adapterContext.fake.store.set("evalRuns/run", withoutSequence);

    const input = event("no-sequence", Buffer.from("payload"), {});
    await beginEvent(adapterContext, input);
    await writeEventChunk(adapterContext, {
      runId: runId,
      eventId: input.eventId,
      index: 0,
      data: Buffer.from("payload").toString("base64"),
    });
    await commitEvent(adapterContext, {
      runId: runId,
      eventId: input.eventId,
    });
    expect(adapterContext.fake.store.get("evalRuns/run")).toMatchObject({
      lastEventSequence: 0,
    });
  });

  it("accepts an empty final chunk and keeps a higher stored sequence", async () => {
    const adapterContext = context();
    adapterContext.fake.store.set("evalRuns/run", {
      ...adapterContext.fake.store.get("evalRuns/run"),
      lastEventSequence: 9,
    });
    const input = event("empty-final", Buffer.alloc(0), {
      run: { status: "completed" },
      session: {
        evaluationId: "weather/london",
        sessionId: "session-2",
        primary: false,
        startedAt: startedAt,
      },
    });
    await beginEvent(adapterContext, input);
    await expect(
      writeEventChunk(adapterContext, {
        runId: runId,
        eventId: input.eventId,
        index: 0,
        data: "",
      }),
    ).resolves.toEqual({ created: true });
    await commitEvent(adapterContext, {
      runId: runId,
      eventId: input.eventId,
    });
    expect(adapterContext.fake.store.get("evalRuns/run")).toMatchObject({
      lastEventSequence: 9,
    });
    expect(adapterContext.fake.store.get("evalRuns/run")).not.toMatchObject({
      status: "completed",
    });
    expect(
      adapterContext.fake.store.get(
        `evalRuns/run/sessions/${firestorePathId("session-2")}`,
      ),
    ).toBeUndefined();
  });

  it("rejects missing events, incomplete chunks, empty middle chunks, and bad checksums", async () => {
    const adapterContext = context();
    await expect(
      beginEvent(adapterContext, { ...event("invalid"), sequence: -1 }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      beginEvent(adapterContext, { ...event("invalid"), sequence: 1.5 }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      beginEvent(adapterContext, { ...event("missing-run"), runId: "missing" }),
    ).rejects.toMatchObject({ code: "not-found" });
    await expect(
      commitEvent(adapterContext, { runId: runId, eventId: "missing" }),
    ).rejects.toMatchObject({ code: "not-found" });
    await expect(
      writeEventChunk(adapterContext, {
        runId: runId,
        eventId: "missing",
        index: 0,
        data: "YQ==",
      }),
    ).rejects.toMatchObject({ code: "not-found" });
    await expect(
      writeEventChunk(adapterContext, {
        runId: runId,
        eventId: "missing",
        index: -1,
        data: "YQ==",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      writeEventChunk(adapterContext, {
        runId: runId,
        eventId: "missing",
        index: 1.5,
        data: "YQ==",
      }),
    ).rejects.toMatchObject({ code: "invalid" });

    const incomplete = event("incomplete", Buffer.alloc(129), {}, 2);
    await beginEvent(adapterContext, incomplete);
    await expect(
      writeEventChunk(adapterContext, {
        runId: runId,
        eventId: "incomplete",
        index: 0,
        data: "",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      writeEventChunk(adapterContext, {
        runId: runId,
        eventId: "incomplete",
        index: 2,
        data: Buffer.from("ab").toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    adapterContext.fake.store.set("evalRuns/run/events/incomplete", {
      ...adapterContext.fake.store.get("evalRuns/run/events/incomplete"),
      payload: { ...incomplete.payload, chunkCount: 1.5 },
    });
    await expect(
      writeEventChunk(adapterContext, {
        runId: runId,
        eventId: "incomplete",
        index: 0,
        data: Buffer.from("ab").toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    adapterContext.fake.store.set("evalRuns/run/events/incomplete", {
      ...adapterContext.fake.store.get("evalRuns/run/events/incomplete"),
      payload: { ...incomplete.payload, chunkSize: 2 },
    });
    await expect(
      writeEventChunk(adapterContext, {
        runId: runId,
        eventId: "incomplete",
        index: 0,
        data: Buffer.from("abcd").toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "too-large" });
    adapterContext.fake.store.set("evalRuns/run/events/incomplete", {
      ...adapterContext.fake.store.get("evalRuns/run/events/incomplete"),
      payload: incomplete.payload,
    });
    await expect(
      commitEvent(adapterContext, { runId: runId, eventId: "incomplete" }),
    ).rejects.toMatchObject({ code: "incomplete" });

    const gap = event("gap", Buffer.from("abcdef"), {}, 2);
    await beginEvent(adapterContext, {
      ...gap,
      sequence: 1,
      payload: { ...gap.payload, chunkSize: 3 },
    });
    await writeEventChunk(adapterContext, {
      runId: runId,
      eventId: "gap",
      index: 1,
      data: Buffer.from("def").toString("base64"),
    });
    await expect(
      commitEvent(adapterContext, { runId: runId, eventId: "gap" }),
    ).rejects.toMatchObject({ code: "incomplete" });

    const badChecksum = event("bad-checksum", Buffer.from("abc"));
    await beginEvent(adapterContext, { ...badChecksum, sequence: 2 });
    await writeEventChunk(adapterContext, {
      runId: runId,
      eventId: "bad-checksum",
      index: 0,
      data: Buffer.from("xyz").toString("base64"),
    });
    await expect(
      commitEvent(adapterContext, {
        runId: runId,
        eventId: "bad-checksum",
      }),
    ).rejects.toMatchObject({ code: "conflict" });

    const ordered = event("ordered", Buffer.from("abcdef"), {}, 2);
    await beginEvent(adapterContext, {
      ...ordered,
      sequence: 3,
      payload: { ...ordered.payload, chunkSize: 3 },
    });
    await writeEventChunk(adapterContext, {
      runId: runId,
      eventId: "ordered",
      index: 1,
      data: Buffer.from("def").toString("base64"),
    });
    await writeEventChunk(adapterContext, {
      runId: runId,
      eventId: "ordered",
      index: 0,
      data: Buffer.from("abc").toString("base64"),
    });
    await expect(
      commitEvent(adapterContext, { runId: runId, eventId: "ordered" }),
    ).resolves.toEqual({ committed: true });
  });

  it("rejects a commit when the run disappears during the transaction", async () => {
    const adapterContext = context();
    const input = event("orphan");
    await beginEvent(adapterContext, input);
    await writeEventChunk(adapterContext, {
      runId: runId,
      eventId: input.eventId,
      index: 0,
      data: Buffer.from("payload").toString("base64"),
    });
    adapterContext.fake.beforeTransaction = () => {
      adapterContext.fake.store.delete("evalRuns/run");
    };

    await expect(
      commitEvent(adapterContext, {
        runId: runId,
        eventId: input.eventId,
      }),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("treats a concurrent commit as already finalized", async () => {
    const adapterContext = context();
    const input = event("raced");
    await beginEvent(adapterContext, input);
    await writeEventChunk(adapterContext, {
      runId: runId,
      eventId: input.eventId,
      index: 0,
      data: Buffer.from("payload").toString("base64"),
    });
    adapterContext.fake.beforeTransaction = () => {
      const existing = adapterContext.fake.store.get(
        "evalRuns/run/events/raced",
      );
      adapterContext.fake.store.set("evalRuns/run/events/raced", {
        ...existing,
        status: "committed",
      });
    };

    await expect(
      commitEvent(adapterContext, {
        runId: runId,
        eventId: input.eventId,
      }),
    ).resolves.toEqual({ committed: false });
    expect(
      adapterContext.fake.store.get("evalRuns/run")?.lastEventSequence,
    ).toBe(-1);
  });
});
