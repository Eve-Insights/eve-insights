import { createHash } from "node:crypto";
import {
  type BeginEventInput,
  DatabaseAdapterError,
} from "@eve-insights/adapter-types";
import { describe, expect, it } from "vitest";
import { MAX_CHUNKS, MAX_PAYLOAD_BYTES } from "./constants.js";
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

describe("validate", () => {
  it("recognizes records, statuses, target kinds, dates, and integers", () => {
    expect(asRecord({ value: 1 })).toEqual({ value: 1 });
    expect(asRecord(null)).toEqual({});
    expect(asRecord([])).toEqual({});
    expect(asRecord("text")).toEqual({});
    expect(isRunStatus("running")).toBe(true);
    expect(isRunStatus("completed")).toBe(true);
    expect(isRunStatus("pending")).toBe(false);
    expect(isTargetKind("local")).toBe(true);
    expect(isTargetKind("remote")).toBe(true);
    expect(isTargetKind("cloud")).toBe(false);
    expect(isNonNegativeInteger(0)).toBe(true);
    expect(isNonNegativeInteger(-1)).toBe(false);
    expect(isNonNegativeInteger(1.5)).toBe(false);
    expect(isNonNegativeInteger("0")).toBe(false);
    expect(isIsoDate("2026-08-30T00:00:00.000Z")).toBe(true);
    expect(isIsoDate("not-a-date")).toBe(false);
    expect(isIsoDate(1)).toBe(false);
  });

  it("validates identifiers and dates with adapter errors", () => {
    expect(() => requireAgentName("Agent")).not.toThrow();
    expect(() => requireAgentName("A".repeat(256))).not.toThrow();
    expect(() =>
      requireEvaluationId("weather/london", "evaluation.id"),
    ).not.toThrow();
    expect(() =>
      requireEvaluationId("A".repeat(256), "evaluation.id"),
    ).not.toThrow();
    expect(() => requireId("run-1", "runId")).not.toThrow();
    expect(() => requireId("A".repeat(256), "runId")).not.toThrow();
    expect(() =>
      requireIsoDate("2026-08-30T00:00:00.000Z", "startedAt"),
    ).not.toThrow();

    for (const invalid of [
      () => requireAgentName(""),
      () => requireAgentName("A".repeat(257)),
      () => requireEvaluationId("", "evaluation.id"),
      () => requireEvaluationId("A".repeat(257), "evaluation.id"),
      () => requireId("", "runId"),
      () => requireId("A".repeat(257), "runId"),
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
    expect(() => decodeChunk("abc", 128)).toThrowError(
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
    expect(canonicalJson(undefined)).toBe("null");
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
    expect(compareEvent({ ...event, type: "eval.completed" }, event)).toBe(
      false,
    );
    expect(
      compareEvent({ ...event, occurredAt: "2026-08-31T00:00:00.000Z" }, event),
    ).toBe(false);
    expect(compareEvent({ ...event, projection: {} }, event)).toBe(false);
    expect(
      compareEvent(
        { ...event, payload: { ...manifest, encoding: "identity" } },
        event,
      ),
    ).toBe(false);
    expect(
      compareEvent(
        { ...event, payload: { ...manifest, contentType: "text/plain" } },
        event,
      ),
    ).toBe(false);
    expect(
      compareEvent(
        { ...event, payload: { ...manifest, byteLength: 4 } },
        event,
      ),
    ).toBe(false);
    expect(
      compareEvent(
        { ...event, payload: { ...manifest, chunkSize: 64 } },
        event,
      ),
    ).toBe(false);
    expect(
      compareEvent(
        { ...event, payload: { ...manifest, chunkCount: 2 } },
        event,
      ),
    ).toBe(false);
    expect(
      compareEvent(
        { ...event, payload: { ...manifest, sha256: "0".repeat(64) } },
        event,
      ),
    ).toBe(false);
  });

  it("validates payload manifest limits", () => {
    expect(() => validatePayloadManifest(manifest, 128)).not.toThrow();
    expect(() =>
      validatePayloadManifest({ ...manifest, chunkCount: 0 }, 128),
    ).toThrowError(expect.objectContaining({ code: "invalid" }));
    expect(() =>
      validatePayloadManifest({ ...manifest, chunkSize: 0 }, 128),
    ).toThrowError(expect.objectContaining({ code: "invalid" }));
    expect(() =>
      validatePayloadManifest({ ...manifest, chunkSize: 129 }, 128),
    ).toThrowError(expect.objectContaining({ code: "invalid" }));
    expect(() =>
      validatePayloadManifest({ ...manifest, chunkCount: 1.5 }, 128),
    ).toThrowError(expect.objectContaining({ code: "invalid" }));
    expect(() =>
      validatePayloadManifest({ ...manifest, chunkCount: MAX_CHUNKS + 1 }, 128),
    ).toThrowError(expect.objectContaining({ code: "invalid" }));
    expect(() =>
      validatePayloadManifest({ ...manifest, byteLength: 1.5 }, 128),
    ).toThrowError(expect.objectContaining({ code: "invalid" }));
    expect(() =>
      validatePayloadManifest({ ...manifest, byteLength: -1 }, 128),
    ).toThrowError(expect.objectContaining({ code: "invalid" }));
    expect(() =>
      validatePayloadManifest(
        { ...manifest, byteLength: MAX_PAYLOAD_BYTES + 1 },
        128,
      ),
    ).toThrowError(expect.objectContaining({ code: "invalid" }));
    expect(() =>
      validatePayloadManifest({ ...manifest, sha256: "bad" }, 128),
    ).toThrowError(expect.objectContaining({ code: "invalid" }));
  });
});
