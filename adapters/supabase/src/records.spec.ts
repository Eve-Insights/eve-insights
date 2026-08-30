import { describe, expect, it } from "vitest";
import {
  emptyCounts,
  eventFromRow,
  readEvaluationRecord,
  readEvaluationRow,
  readRunRecord,
  readRunRow,
  runRowFromInput,
  validatedCounts,
} from "./records.js";

const validRun = {
  runId: "run",
  agentId: "agent",
  startedAt: "2026-08-30T00:00:00.000Z",
  kind: "local",
  url: "http://localhost:3002",
  name: "Weather Agent",
  capabilities: { devRoutes: true },
  status: "running",
  evaluationCount: 1,
  counts: emptyCounts(1),
  lastEventSequence: -1,
};

const validEvaluation = {
  id: "weather/london",
  status: "pending" as const,
  description: "Weather",
  tags: ["smoke"],
  timeoutMs: 1000,
  startedAt: "2026-08-30T00:00:00.000Z",
  completedAt: "2026-08-30T00:01:00.000Z",
  verdict: "passed" as const,
  error: "none",
  skipReason: "n/a",
  assertionCount: 1,
  passedAssertionCount: 1,
  failedAssertionCount: 0,
};

describe("records", () => {
  it("creates empty counts and validates complete counts", () => {
    expect(emptyCounts(2)).toEqual({
      total: 2,
      passed: 0,
      failed: 0,
      scored: 0,
      skipped: 0,
      errored: 0,
    });
    expect(validatedCounts(emptyCounts(2))).toEqual(emptyCounts(2));
    expect(() => validatedCounts({ total: 1 })).toThrowError(
      expect.objectContaining({ code: "invalid" }),
    );
    expect(() =>
      validatedCounts({ ...emptyCounts(1), passed: 1.5 }),
    ).toThrowError(expect.objectContaining({ code: "invalid" }));
    expect(() =>
      validatedCounts({ ...emptyCounts(1), failed: -1 }),
    ).toThrowError(expect.objectContaining({ code: "invalid" }));
  });

  it("reads valid runs and skips malformed runs", () => {
    expect(readRunRecord(validRun)).toEqual(validRun);
    expect(
      readRunRecord({ ...validRun, completedAt: "2026-08-30T01:00:00.000Z" }),
    ).toEqual({
      ...validRun,
      completedAt: "2026-08-30T01:00:00.000Z",
    });
    expect(readRunRecord({ ...validRun, runId: "" })).toBeUndefined();
    expect(readRunRecord({ ...validRun, agentId: "" })).toBeUndefined();
    expect(readRunRecord({ ...validRun, kind: "cloud" })).toBeUndefined();
    expect(readRunRecord({ ...validRun, url: "" })).toBeUndefined();
    expect(readRunRecord({ ...validRun, name: "" })).toBeUndefined();
    expect(
      readRunRecord({ ...validRun, startedAt: "not-a-date" }),
    ).toBeUndefined();
    expect(readRunRecord({ ...validRun, status: "pending" })).toBeUndefined();
    expect(readRunRecord({ ...validRun, evaluationCount: -1 })).toBeUndefined();
    expect(
      readRunRecord({ ...validRun, lastEventSequence: -2 }),
    ).toBeUndefined();
    expect(
      readRunRecord({ ...validRun, lastEventSequence: 1.5 }),
    ).toBeUndefined();
    expect(
      readRunRecord({ ...validRun, capabilities: { devRoutes: "yes" } }),
    ).toBeUndefined();
    expect(
      readRunRecord({ ...validRun, counts: { total: 1 } }),
    ).toBeUndefined();
    expect(
      readRunRecord({ ...validRun, completedAt: "not-a-date" }),
    ).toBeUndefined();
  });

  it("maps Supabase run rows into validated run records", () => {
    expect(
      readRunRow({
        run_id: "run",
        agent_id: "agent",
        started_at: "2026-08-30T00:00:00.000Z",
        kind: "local",
        url: "http://localhost:3002",
        name: "Weather Agent",
        capabilities: { devRoutes: true },
        status: "running",
        evaluation_count: 1,
        counts: emptyCounts(1),
        last_event_sequence: -1,
        completed_at: null,
      }),
    ).toEqual(validRun);
    expect(
      readRunRow({
        run_id: "run",
        agent_id: "agent",
        started_at: "2026-08-30T00:00:00.000Z",
        kind: "local",
        url: "http://localhost:3002",
        name: "Weather Agent",
        capabilities: { devRoutes: true },
        status: "completed",
        evaluation_count: 1,
        counts: emptyCounts(1),
        last_event_sequence: 0,
        completed_at: "2026-08-30T01:00:00.000Z",
      }),
    ).toMatchObject({ completedAt: "2026-08-30T01:00:00.000Z" });
    expect(readRunRow({ run_id: "broken" })).toBeUndefined();
  });

  it("reads valid evaluations and skips malformed evaluations", () => {
    expect(readEvaluationRecord(validEvaluation)).toEqual(validEvaluation);
    expect(readEvaluationRecord({ id: "eval", status: "pending" })).toEqual({
      id: "eval",
      status: "pending",
    });
    expect(readEvaluationRecord({ id: "", status: "pending" })).toBeUndefined();
    expect(
      readEvaluationRecord({ id: "eval", status: "unknown" }),
    ).toBeUndefined();
    expect(
      readEvaluationRecord({
        id: "eval",
        status: "pending",
        description: 1,
      }),
    ).toBeUndefined();
    expect(
      readEvaluationRecord({ id: "eval", status: "pending", tags: "smoke" }),
    ).toBeUndefined();
    expect(
      readEvaluationRecord({ id: "eval", status: "pending", tags: [1] }),
    ).toBeUndefined();
    expect(
      readEvaluationRecord({ id: "eval", status: "pending", timeoutMs: 0 }),
    ).toBeUndefined();
    expect(
      readEvaluationRecord({ id: "eval", status: "pending", timeoutMs: 1.5 }),
    ).toBeUndefined();
    expect(
      readEvaluationRecord({
        id: "eval",
        status: "pending",
        startedAt: "nope",
      }),
    ).toBeUndefined();
    expect(
      readEvaluationRecord({
        id: "eval",
        status: "pending",
        completedAt: "nope",
      }),
    ).toBeUndefined();
    expect(
      readEvaluationRecord({
        id: "eval",
        status: "pending",
        verdict: "unknown",
      }),
    ).toBeUndefined();
    expect(
      readEvaluationRecord({ id: "eval", status: "pending", error: 1 }),
    ).toBeUndefined();
    expect(
      readEvaluationRecord({ id: "eval", status: "pending", skipReason: 1 }),
    ).toBeUndefined();
    expect(
      readEvaluationRecord({
        id: "eval",
        status: "pending",
        assertionCount: -1,
      }),
    ).toBeUndefined();
    expect(
      readEvaluationRecord({
        id: "eval",
        status: "pending",
        passedAssertionCount: -1,
      }),
    ).toBeUndefined();
    expect(
      readEvaluationRecord({
        id: "eval",
        status: "pending",
        failedAssertionCount: -1,
      }),
    ).toBeUndefined();
  });

  it("maps Supabase evaluation rows and strips nullable fields", () => {
    expect(
      readEvaluationRow({
        evaluation_id: "weather/london",
        status: "pending",
        description: null,
        tags: null,
        timeout_ms: null,
        started_at: null,
        completed_at: null,
        verdict: null,
        error: null,
        skip_reason: null,
        assertion_count: null,
        passed_assertion_count: null,
        failed_assertion_count: null,
      }),
    ).toEqual({ id: "weather/london", status: "pending" });
    expect(
      readEvaluationRow({
        evaluation_id: "weather/london",
        status: "completed",
        description: "Weather",
        tags: ["smoke"],
        timeout_ms: 1000,
        started_at: "2026-08-30T00:00:00.000Z",
        completed_at: "2026-08-30T00:01:00.000Z",
        verdict: "passed",
        error: "none",
        skip_reason: "n/a",
        assertion_count: 1,
        passed_assertion_count: 1,
        failed_assertion_count: 0,
      }),
    ).toEqual({
      ...validEvaluation,
      id: "weather/london",
      status: "completed",
    });
    expect(
      readEvaluationRow({ evaluation_id: "eval", status: "unknown" }),
    ).toBe(undefined);
  });

  it("converts inputs and event rows to Supabase-shaped records", () => {
    expect(
      runRowFromInput({
        runId: "run",
        startedAt: "2026-08-30T00:00:00.000Z",
        target: {
          agentId: "agent",
          kind: "local",
          url: "http://localhost:3002",
          name: "Weather Agent",
          capabilities: { devRoutes: true },
        },
        evaluations: [{ id: "weather/london" }, { id: "weather/paris" }],
      }),
    ).toEqual({
      run_id: "run",
      agent_id: "agent",
      started_at: "2026-08-30T00:00:00.000Z",
      kind: "local",
      url: "http://localhost:3002",
      name: "Weather Agent",
      capabilities: { devRoutes: true },
      status: "running",
      evaluation_count: 2,
      counts: emptyCounts(2),
      last_event_sequence: -1,
    });
    expect(
      eventFromRow({
        run_id: "run",
        event_id: "event",
        sequence: 0,
        type: "eval.started",
        occurred_at: "2026-08-30T00:00:00.000Z",
        projection: {},
        payload: {},
        status: "staged",
        committed_at: null,
      }),
    ).toEqual({
      runId: "run",
      eventId: "event",
      sequence: 0,
      type: "eval.started",
      occurredAt: "2026-08-30T00:00:00.000Z",
      projection: {},
      payload: {},
      status: "staged",
      committedAt: null,
    });
  });
});
