import { describe, expect, it } from "vitest";
import { sqliteAdapterOptionsSchema } from "./types.js";

describe("sqliteAdapterOptionsSchema", () => {
  it("normalizes the path and applies defaults", () => {
    expect(
      sqliteAdapterOptionsSchema.parse({
        path: " ./data/eve_insights.db ",
      }),
    ).toEqual({
      path: "./data/eve_insights.db",
      maxChunkBytes: 262_144,
    });
    expect(
      sqliteAdapterOptionsSchema.parse({
        path: ":memory:",
        maxChunkBytes: 128,
      }).maxChunkBytes,
    ).toBe(128);
  });

  it("rejects an empty path and invalid chunk sizes", () => {
    expect(() => sqliteAdapterOptionsSchema.parse({ path: "" })).toThrow();
    expect(() =>
      sqliteAdapterOptionsSchema.parse({
        path: ":memory:",
        maxChunkBytes: 0,
      }),
    ).toThrow();
  });
});
