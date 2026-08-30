import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import type {
  WireJsonObject,
  WireJsonValue,
  WirePayloadManifest,
} from "./protocol.js";

const CIRCULAR_VALUE = "[Circular]";
const MAX_DEPTH = 32;
type MutableWireJsonObject = { [key: string]: WireJsonValue };

function marker(type: string, value?: WireJsonValue): WireJsonObject {
  return value === undefined ? { $type: type } : { $type: type, value };
}

function serializeValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): WireJsonValue {
  if (value === null) return null;

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : marker("number", String(value));
    case "bigint":
      return marker("bigint", `${value}n`);
    case "undefined":
      return marker("undefined");
    case "symbol":
      return marker("symbol", String(value));
    case "function":
      return marker("function", value.name || "anonymous");
    default:
      break;
  }

  if (depth >= MAX_DEPTH) return marker("max-depth");

  if (value instanceof Date) {
    const iso = Number.isNaN(value.getTime()) ? undefined : value.toISOString();
    return iso === undefined ? marker("date") : marker("date", iso);
  }

  if (value instanceof Error) {
    if (seen.has(value)) return CIRCULAR_VALUE;
    seen.add(value);
    const error: MutableWireJsonObject = {
      name: value.name,
      message: value.message,
    };
    if (value.stack) error.stack = value.stack;
    if ("cause" in value) {
      error.cause = serializeValue(
        (value as Error & { cause?: unknown }).cause,
        seen,
        depth + 1,
      );
    }
    return error;
  }

  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(
      value.buffer,
      value.byteOffset,
      value.byteLength,
    );
    return marker("bytes", Buffer.from(bytes).toString("base64"));
  }

  if (value instanceof ArrayBuffer) {
    return marker("bytes", Buffer.from(value).toString("base64"));
  }

  if (seen.has(value)) return CIRCULAR_VALUE;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item, seen, depth + 1));
  }

  if (value instanceof Map) {
    return {
      $type: "map",
      value: [...value.entries()].map(([key, item]) => [
        serializeValue(key, seen, depth + 1),
        serializeValue(item, seen, depth + 1),
      ]),
    };
  }

  if (value instanceof Set) {
    return {
      $type: "set",
      value: [...value].map((item) => serializeValue(item, seen, depth + 1)),
    };
  }

  const object: MutableWireJsonObject = {};
  for (const key of Object.keys(value).sort()) {
    try {
      object[key] = serializeValue(
        (value as Record<string, unknown>)[key],
        seen,
        depth + 1,
      );
    } catch (error) {
      object[key] = serializeValue(error, seen, depth + 1);
    }
  }
  return object;
}

/** Converts Eve's callback data into deterministic JSON-safe data. */
export function serializeForTransport(value: unknown): WireJsonValue {
  return serializeValue(value, new WeakSet<object>(), 0);
}

export function stableJson(value: unknown): string {
  return JSON.stringify(serializeForTransport(value));
}

export interface CompressedPayload {
  readonly manifest: WirePayloadManifest;
  readonly chunks: readonly string[];
}

export function compressPayload(
  value: unknown,
  chunkSize: number,
): CompressedPayload {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error(
      `Payload chunk size must be a positive integer; got ${chunkSize}.`,
    );
  }

  const compressed = gzipSync(Buffer.from(stableJson(value), "utf8"));
  const chunks: string[] = [];
  for (let offset = 0; offset < compressed.length; offset += chunkSize) {
    chunks.push(
      compressed.subarray(offset, offset + chunkSize).toString("base64"),
    );
  }

  if (chunks.length === 0) chunks.push("");

  return {
    manifest: {
      encoding: "gzip",
      contentType: "application/json",
      byteLength: compressed.length,
      chunkSize,
      chunkCount: chunks.length,
      sha256: createHash("sha256").update(compressed).digest("hex"),
    },
    chunks,
  };
}
