import { describe, expect, it } from "vitest";
import { defineDatabaseAdapterContract } from "./contract.js";
import { isConsistentPayloadManifest, PACKAGE_NAME } from "./index.js";

describe("@eve-insights/adapter-types", () => {
  it("exposes its package name", () => {
    expect(PACKAGE_NAME).toBe("@eve-insights/adapter-types");
    expect(typeof defineDatabaseAdapterContract).toBe("function");
  });

  it("rejects manifests that cannot produce the declared byte length", () => {
    expect(
      isConsistentPayloadManifest({
        byteLength: 1,
        chunkSize: 262144,
        chunkCount: 1024,
      }),
    ).toBe(false);
    expect(
      isConsistentPayloadManifest({
        byteLength: 0,
        chunkSize: 128,
        chunkCount: 1,
      }),
    ).toBe(true);
    expect(
      isConsistentPayloadManifest({
        byteLength: 129,
        chunkSize: 128,
        chunkCount: 2,
      }),
    ).toBe(true);
    expect(
      isConsistentPayloadManifest({
        byteLength: 128,
        chunkSize: 128,
        chunkCount: 2,
      }),
    ).toBe(false);
  });
});
