import { createHash } from "node:crypto";
import type { BeginEventInput } from "@eve-insights/adapter-types";
import { DatabaseAdapterError } from "@eve-insights/adapter-types";
import { describe, expect, it } from "vitest";
import {
  asRecord,
  canonicalJson,
  compareEvent,
  decodeChunk,
  isIsoDate,
  isNonNegativeInteger,
  isRunStatus,
  isTargetKind,
  requireAgentName,
  requireEvaluationId,
  requireId,
  requireIsoDate,
  validatePayloadManifest,
} from "./validate.js";

const manifest = {
  encoding: "gzip" as const,
  contentType: "application/json" as const,
  byteLength: 3,
  chunkSize: 128,
  chunkCount: 1,
  sha256: createHash("sha256").update("abc").digest("hex"),
};

const event: BeginEventInput = {
  runId: "run",
  eventId: "event",
  sequence: 0,
  type: "eval.started",
  occurredAt: "2026-08-30T00:00:00.000Z",
  projection: { evaluation: { id: "eval", status: "running" } },
  payload: manifest,
};

describe("validate helpers", () => {
  it("recognizes records, statuses, target kinds, dates, and integers", () => {
    expect(asRecord({ value: 1 })).toEqual({ value: 1 });
    expect(asRecord(null)).toEqual({});
    expect(isRunStatus("running")).toBe(true);
    expect(isRunStatus("pending")).toBe(false);
    expect(isTargetKind("local")).toBe(true);
    expect(isTargetKind("remote")).toBe(true);
    expect(isTargetKind("cloud")).toBe(false);
    expect(isNonNegativeInteger(0)).toBe(true);
    expect(isNonNegativeInteger(-1)).toBe(false);
    expect(isIsoDate("2026-08-30T00:00:00.000Z")).toBe(true);
    expect(isIsoDate("not-a-date")).toBe(false);
  });

  it("validates identifiers and dates with adapter errors", () => {
    expect(() => requireAgentName("Agent")).not.toThrow();
    expect(() =>
      requireEvaluationId("weather/london", "evaluation.id"),
    ).not.toThrow();
    expect(() => requireId("run-1", "runId")).not.toThrow();
    expect(() =>
      requireIsoDate("2026-08-30T00:00:00.000Z", "startedAt"),
    ).not.toThrow();

    for (const invalid of [
      () => requireAgentName(""),
      () => requireEvaluationId("", "evaluation.id"),
      () => requireId("has/slash", "runId"),
      () => requireIsoDate("invalid", "startedAt"),
    ]) {
      expect(invalid).toThrow(DatabaseAdapterError);
      expect(invalid).toThrowError(
        expect.objectContaining({ code: "invalid" }),
      );
    }
  });

  it("decodes base64 and rejects malformed or oversized chunks", () => {
    expect(decodeChunk(Buffer.from("abc").toString("base64"), 3)).toEqual(
      Buffer.from("abc"),
    );
    expect(() => decodeChunk("not base64", 128)).toThrowError(
      expect.objectContaining({ code: "invalid" }),
    );
    expect(() =>
      decodeChunk(Buffer.from("abcd").toString("base64"), 3),
    ).toThrowError(expect.objectContaining({ code: "too-large" }));
  });

  it("canonicalizes object keys and compares event metadata", () => {
    expect(canonicalJson({ b: 2, a: [true, null] })).toBe(
      '{"a":[true,null],"b":2}',
    );
    expect(
      compareEvent(
        {
          ...event,
          projection: { evaluation: { status: "running", id: "eval" } },
        },
        event,
      ),
    ).toBe(true);
    expect(compareEvent({ ...event, sequence: 1 }, event)).toBe(false);
  });

  it("validates payload manifest limits", () => {
    expect(() => validatePayloadManifest(manifest, 128)).not.toThrow();
    expect(() =>
      validatePayloadManifest({ ...manifest, chunkCount: 0 }, 128),
    ).toThrowError(expect.objectContaining({ code: "invalid" }));
    expect(() =>
      validatePayloadManifest({ ...manifest, chunkSize: 129 }, 128),
    ).toThrowError(expect.objectContaining({ code: "invalid" }));
    expect(() =>
      validatePayloadManifest({ ...manifest, sha256: "bad" }, 128),
    ).toThrowError(expect.objectContaining({ code: "invalid" }));
  });
});
