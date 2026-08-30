import { describe, expect, it } from "vitest";
import {
  MAX_CHUNK_BYTES,
  MAX_CHUNKS,
  MAX_PAYLOAD_BYTES,
  MAX_RUN_EVALUATIONS,
} from "./constants.js";

describe("constants", () => {
  it("exports the documented persistence limits", () => {
    expect(MAX_CHUNK_BYTES).toBe(256 * 1024);
    expect(MAX_PAYLOAD_BYTES).toBe(64 * 1024 * 1024);
    expect(MAX_CHUNKS).toBe(1024);
    expect(MAX_RUN_EVALUATIONS).toBe(10_000);
  });
});
