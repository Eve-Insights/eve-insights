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

describe("record helpers", () => {
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
  });

  it("reads valid runs and skips malformed runs", () => {
    expect(readRunRecord(validRun)).toEqual(validRun);
    expect(
      readRunRecord({ ...validRun, capabilities: { devRoutes: "yes" } }),
    ).toBeUndefined();
    expect(
      readRunRecord({ ...validRun, completedAt: "not-a-date" }),
    ).toBeUndefined();
  });

  it("reads valid evaluations and skips malformed evaluations", () => {
    expect(
      readEvaluationRecord({
        id: "weather/london",
        status: "pending",
        description: "Weather",
        tags: ["smoke"],
        timeoutMs: 1000,
      }),
    ).toEqual({
      id: "weather/london",
      status: "pending",
      description: "Weather",
      tags: ["smoke"],
      timeoutMs: 1000,
    });
    expect(
      readEvaluationRecord({ id: "eval", status: "unknown" }),
    ).toBeUndefined();
    expect(
      readEvaluationRecord({ id: "eval", status: "pending", timeoutMs: 0 }),
    ).toBeUndefined();
  });
});
