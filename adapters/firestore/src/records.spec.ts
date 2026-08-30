import { describe, expect, it } from "vitest";
import {
  emptyCounts,
  readEvaluationRecord,
  readRunRecord,
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
});
