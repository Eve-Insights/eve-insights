import { describe, expect, it } from "vitest";
import { MAX_CHUNK_BYTES } from "./constants.js";
import { supabaseAdapterOptionsSchema } from "./types.js";

describe("types", () => {
  it("requires a URL and secret key and defaults the chunk limit", () => {
    expect(
      supabaseAdapterOptionsSchema.parse({
        url: "https://example.supabase.co",
        secretKey: "secret",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      secretKey: "secret",
      maxChunkBytes: MAX_CHUNK_BYTES,
    });
    expect(
      supabaseAdapterOptionsSchema.parse({
        url: "https://example.supabase.co",
        secretKey: "secret",
        maxChunkBytes: 128,
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      secretKey: "secret",
      maxChunkBytes: 128,
    });
  });

  it("rejects empty connection fields and invalid chunk sizes", () => {
    expect(() =>
      supabaseAdapterOptionsSchema.parse({
        url: "",
        secretKey: "secret",
      }),
    ).toThrow();
    expect(() =>
      supabaseAdapterOptionsSchema.parse({
        url: "https://example.supabase.co",
        secretKey: "",
      }),
    ).toThrow();
    expect(() =>
      supabaseAdapterOptionsSchema.parse({
        url: "https://example.supabase.co",
        secretKey: "secret",
        maxChunkBytes: 0,
      }),
    ).toThrow();
    expect(() =>
      supabaseAdapterOptionsSchema.parse({
        url: "https://example.supabase.co",
        secretKey: "secret",
        maxChunkBytes: MAX_CHUNK_BYTES + 1,
      }),
    ).toThrow();
  });
});
