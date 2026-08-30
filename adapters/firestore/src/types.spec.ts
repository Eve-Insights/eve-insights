import { describe, expect, it } from "vitest";
import { MAX_CHUNK_BYTES } from "./constants.js";
import { firestoreAdapterOptionsSchema } from "./types.js";

describe("types", () => {
  it("requires a project id and defaults the chunk limit", () => {
    expect(
      firestoreAdapterOptionsSchema.parse({ projectId: "test-project" }),
    ).toEqual({
      projectId: "test-project",
      maxChunkBytes: MAX_CHUNK_BYTES,
    });
    expect(
      firestoreAdapterOptionsSchema.parse({
        projectId: "test-project",
        maxChunkBytes: 128,
      }),
    ).toEqual({
      projectId: "test-project",
      maxChunkBytes: 128,
    });
  });

  it("rejects an empty project id and an invalid chunk size", () => {
    expect(() =>
      firestoreAdapterOptionsSchema.parse({ projectId: "" }),
    ).toThrow();
    expect(() =>
      firestoreAdapterOptionsSchema.parse({
        projectId: "test-project",
        maxChunkBytes: 0,
      }),
    ).toThrow();
    expect(() =>
      firestoreAdapterOptionsSchema.parse({
        projectId: "test-project",
        maxChunkBytes: MAX_CHUNK_BYTES + 1,
      }),
    ).toThrow();
  });
});
