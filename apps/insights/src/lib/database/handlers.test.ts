// @vitest-environment node

import type { DatabaseAdapter } from "@eve-insights/adapter-types";
import { describe, expect, it, vi } from "vitest";
import {
  handleBeginEvent,
  handleCommitEvent,
  handleCreateRun,
  handleWriteEventChunk,
} from "./handlers";

function fakeDatabase(): DatabaseAdapter {
  return {
    listAgents: vi.fn(async () => []),
    listRuns: vi.fn(async () => []),
    getRunReport: vi.fn(async () => undefined),
    createRun: vi.fn(async () => ({ created: true })),
    beginEvent: vi.fn(async () => ({ created: true })),
    writeEventChunk: vi.fn(async () => ({ created: true })),
    commitEvent: vi.fn(async () => ({ committed: true })),
  };
}

function request(body: unknown): Request {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("ingestion handlers", () => {
  it("validates and maps run registration", async () => {
    const database = fakeDatabase();
    const response = await handleCreateRun(
      request({
        version: 2,
        action: "run.create",
        runId: "run-1",
        startedAt: "2026-08-30T00:00:00.000Z",
        target: {
          agentId: "11111111-1111-5111-8111-111111111111",
          kind: "local",
          url: "http://localhost:3002",
          name: "Test Agent",
          capabilities: { devRoutes: true },
        },
        evaluations: [{ id: "weather/london", tags: ["smoke"] }],
      }),
      database,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      ok: true,
      runId: "run-1",
      created: true,
    });
    expect(database.createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-1",
        target: expect.objectContaining({
          agentId: "11111111-1111-5111-8111-111111111111",
        }),
        evaluations: [{ id: "weather/london", tags: ["smoke"] }],
      }),
    );
  });

  it("requires an agent name when registering a run", async () => {
    const database = fakeDatabase();
    const response = await handleCreateRun(
      request({
        version: 2,
        action: "run.create",
        runId: "run-without-agent-name",
        startedAt: "2026-08-30T00:00:00.000Z",
        target: {
          agentId: "11111111-1111-5111-8111-111111111111",
          kind: "local",
          url: "http://localhost:3002",
          capabilities: { devRoutes: true },
        },
        evaluations: [],
      }),
      database,
    );

    expect(response.status).toBe(400);
    expect(database.createRun).not.toHaveBeenCalled();
  });

  it("returns a client error for malformed JSON and mismatched commit IDs", async () => {
    const database = fakeDatabase();
    const malformed = new Request("http://localhost/api", {
      method: "POST",
      body: "{",
    });
    expect((await handleCreateRun(malformed, database)).status).toBe(400);

    const response = await handleCommitEvent(
      request({ version: 2, action: "event.commit", eventId: "other" }),
      "event-1",
      "event-1",
      database,
    );
    expect(response.status).toBe(400);
    expect(database.commitEvent).not.toHaveBeenCalled();
  });

  it("maps event begin, chunk, and commit operations", async () => {
    const database = fakeDatabase();
    const manifest = {
      encoding: "gzip",
      contentType: "application/json",
      byteLength: 1,
      chunkSize: 128,
      chunkCount: 1,
      sha256: "a".repeat(64),
    };

    expect(
      (
        await handleBeginEvent(
          request({
            version: 2,
            action: "event.begin",
            eventId: "event-1",
            sequence: 0,
            type: "eval.started",
            occurredAt: "2026-08-30T00:00:00.000Z",
            projection: {},
            payload: manifest,
          }),
          "run-1",
          database,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await handleWriteEventChunk(
          request({
            version: 2,
            action: "event.chunk",
            eventId: "event-1",
            index: 0,
            data: "eA==",
          }),
          "run-1",
          "event-1",
          database,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await handleCommitEvent(
          request({ version: 2, action: "event.commit", eventId: "event-1" }),
          "run-1",
          "event-1",
          database,
        )
      ).status,
    ).toBe(200);
  });

  it("returns 200 when run registration is idempotent", async () => {
    const database = fakeDatabase();
    database.createRun = vi.fn(async () => ({ created: false }));
    const response = await handleCreateRun(
      request({
        version: 2,
        action: "run.create",
        runId: "run-1",
        startedAt: "2026-08-30T00:00:00.000Z",
        target: {
          agentId: "11111111-1111-5111-8111-111111111111",
          kind: "local",
          url: "http://localhost:3002",
          name: "Test Agent",
          capabilities: { devRoutes: true },
        },
        evaluations: [],
      }),
      database,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ created: false });
  });

  it("rejects a chunk whose body eventId does not match the route", async () => {
    const database = fakeDatabase();
    const response = await handleWriteEventChunk(
      request({
        version: 2,
        action: "event.chunk",
        eventId: "other",
        index: 0,
        data: "eA==",
      }),
      "run-1",
      "event-1",
      database,
    );
    expect(response.status).toBe(400);
    expect(database.writeEventChunk).not.toHaveBeenCalled();
  });

  it("rejects a manifest that cannot produce its declared byte length", async () => {
    const database = fakeDatabase();
    const response = await handleBeginEvent(
      request({
        version: 2,
        action: "event.begin",
        eventId: "event-1",
        sequence: 0,
        type: "eval.started",
        occurredAt: "2026-08-30T00:00:00.000Z",
        projection: {},
        payload: {
          encoding: "gzip",
          contentType: "application/json",
          byteLength: 1,
          chunkSize: 262144,
          chunkCount: 1024,
          sha256: "a".repeat(64),
        },
      }),
      "run-1",
      database,
    );
    expect(response.status).toBe(400);
    expect(database.beginEvent).not.toHaveBeenCalled();
  });

  it("rejects an invalid run status in the projection", async () => {
    const database = fakeDatabase();
    const response = await handleBeginEvent(
      request({
        version: 2,
        action: "event.begin",
        eventId: "event-1",
        sequence: 0,
        type: "run.completed",
        occurredAt: "2026-08-30T00:00:00.000Z",
        projection: { run: { status: "vanished" } },
        payload: {
          encoding: "gzip",
          contentType: "application/json",
          byteLength: 1,
          chunkSize: 128,
          chunkCount: 1,
          sha256: "a".repeat(64),
        },
      }),
      "run-1",
      database,
    );
    expect(response.status).toBe(400);
    expect(database.beginEvent).not.toHaveBeenCalled();
  });

  it("returns 503 when the database factory fails to parse env", async () => {
    const { ZodError } = await import("zod");
    const response = await handleCreateRun(
      request({
        version: 2,
        action: "run.create",
        runId: "run-1",
        startedAt: "2026-08-30T00:00:00.000Z",
        target: {
          agentId: "11111111-1111-5111-8111-111111111111",
          kind: "local",
          url: "http://localhost:3002",
          name: "Test Agent",
          capabilities: { devRoutes: true },
        },
        evaluations: [],
      }),
      () => {
        throw new ZodError([]);
      },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      error: "Database is not configured.",
    });
  });

  it("rejects an oversized body even when Content-Length is omitted", async () => {
    const database = fakeDatabase();
    const oversized = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(512 * 1024 + 1),
    });
    const response = await handleCreateRun(oversized, database);
    expect(response.status).toBe(413);
    expect(database.createRun).not.toHaveBeenCalled();
  });

  it("rejects an oversized body when Content-Length is spoofed downward", async () => {
    const database = fakeDatabase();
    const oversized = new Request("http://localhost/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "12",
      },
      body: "x".repeat(512 * 1024 + 1),
    });
    const response = await handleCreateRun(oversized, database);
    expect(response.status).toBe(413);
    expect(database.createRun).not.toHaveBeenCalled();
  });
});
