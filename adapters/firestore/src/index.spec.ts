import { describe, expect, it } from "vitest";
import {
  createFirestoreAdapter,
  FirestoreAdapter,
  firestoreAdapterOptionsSchema,
  firestoreEnvSchema,
  firestorePathId,
  PACKAGE_NAME,
} from "./index.js";

describe("index", () => {
  it("re-exports the public adapter surface", () => {
    expect(PACKAGE_NAME).toBe("@eve-insights/adapter-firestore");
    expect(typeof createFirestoreAdapter).toBe("function");
    expect(FirestoreAdapter).toBeTypeOf("function");
    expect(firestoreAdapterOptionsSchema).toBeDefined();
    expect(firestoreEnvSchema).toBeDefined();
    expect(firestorePathId("weather/london")).toMatch(/^[a-f0-9]{64}$/);
  });
});
