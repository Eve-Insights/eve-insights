import {
  type BeginEventInput,
  DatabaseAdapterError,
  isConsistentPayloadManifest,
  type RunStatus,
  type TargetSnapshot,
} from "@eve-insights/adapter-types";
import { MAX_CHUNKS, MAX_PAYLOAD_BYTES } from "./constants.js";

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isRunStatus(value: unknown): value is RunStatus {
  return value === "running" || value === "completed";
}

export function isTargetKind(value: unknown): value is TargetSnapshot["kind"] {
  return value === "local" || value === "remote";
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function requireAgentName(value: string): void {
  if (!value || value.length > 256) {
    throw new DatabaseAdapterError(
      "invalid",
      "target.name must be 1–256 characters.",
    );
  }
}

export function requireId(value: string, field: string): void {
  if (!value || value.length > 256 || value.includes("/")) {
    throw new DatabaseAdapterError(
      "invalid",
      `${field} must be 1–256 characters and must not contain '/'.`,
    );
  }
}

export function requireEvaluationId(value: string, field: string): void {
  if (!value || value.length > 256) {
    throw new DatabaseAdapterError(
      "invalid",
      `${field} must be 1–256 characters.`,
    );
  }
}

export function requireIsoDate(value: string, field: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new DatabaseAdapterError("invalid", `${field} must be an ISO date.`);
  }
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function decodeChunk(data: string, maxBytes: number): Buffer {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length % 4 !== 0) {
    throw new DatabaseAdapterError(
      "invalid",
      "Event chunk is not valid base64.",
    );
  }
  const decoded = Buffer.from(data, "base64");
  if (decoded.length > maxBytes) {
    throw new DatabaseAdapterError(
      "too-large",
      `Event chunk exceeds the ${maxBytes}-byte limit.`,
    );
  }
  return decoded;
}

function compareManifest(
  left: Record<string, unknown>,
  right: BeginEventInput["payload"],
): boolean {
  return (
    left.encoding === right.encoding &&
    left.contentType === right.contentType &&
    left.byteLength === right.byteLength &&
    left.chunkSize === right.chunkSize &&
    left.chunkCount === right.chunkCount &&
    left.sha256 === right.sha256
  );
}

export function compareEvent(
  existing: Record<string, unknown>,
  input: BeginEventInput,
): boolean {
  return (
    existing.sequence === input.sequence &&
    existing.type === input.type &&
    existing.occurredAt === input.occurredAt &&
    canonicalJson(existing.projection) === canonicalJson(input.projection) &&
    compareManifest(asRecord(existing.payload), input.payload)
  );
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function validatePayloadManifest(
  payload: BeginEventInput["payload"],
  maxChunkBytes: number,
): void {
  if (
    payload.chunkCount < 1 ||
    payload.chunkSize < 1 ||
    payload.chunkSize > maxChunkBytes ||
    !Number.isInteger(payload.chunkCount) ||
    payload.chunkCount > MAX_CHUNKS ||
    !Number.isInteger(payload.byteLength) ||
    payload.byteLength < 0 ||
    payload.byteLength > MAX_PAYLOAD_BYTES ||
    !/^[a-f0-9]{64}$/.test(payload.sha256) ||
    !isConsistentPayloadManifest(payload)
  ) {
    throw new DatabaseAdapterError(
      "invalid",
      "Event payload manifest is invalid.",
    );
  }
}
