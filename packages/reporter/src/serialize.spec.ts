import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { compressPayload, serializeForTransport } from "./serialize.js";

describe("serializeForTransport", () => {
  it("serializes values that JSON.stringify cannot represent", () => {
    const shared = { value: 1 };
    const serialized = serializeForTransport({
      bigint: 1n,
      circular: Object.assign(shared, { self: shared }),
      date: new Date("2026-08-30T00:00:00.000Z"),
      nan: Number.NaN,
      missing: undefined,
    });

    expect(serialized).toEqual({
      bigint: { $type: "bigint", value: "1n" },
      circular: { self: "[Circular]", value: 1 },
      date: { $type: "date", value: "2026-08-30T00:00:00.000Z" },
      missing: { $type: "undefined" },
      nan: { $type: "number", value: "NaN" },
    });
  });

  it("serializes invalid dates without throwing", () => {
    expect(serializeForTransport(new Date(Number.NaN))).toEqual({
      $type: "date",
    });
  });
});

describe("compressPayload", () => {
  it("compresses payloads into checksummed bounded chunks", () => {
    const payload = compressPayload({ text: "eve ".repeat(1_000) }, 64);
    const bytes = Buffer.concat(
      payload.chunks.map((chunk) => Buffer.from(chunk, "base64")),
    );

    expect(payload.manifest.chunkCount).toBe(payload.chunks.length);
    expect(payload.manifest.byteLength).toBe(bytes.length);
    expect(gunzipSync(bytes).toString("utf8")).toContain('"text"');
    expect(payload.chunks.every((chunk) => chunk.length <= 100)).toBe(true);
  });
});
