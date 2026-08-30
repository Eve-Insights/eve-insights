import type { Firestore } from "@google-cloud/firestore";
import { describe, expect, it } from "vitest";
import { MAX_BATCH_WRITES } from "./constants.js";
import { FakeFirestore } from "./fake-firestore.js";
import {
  commitInBatches,
  evaluationRef,
  eventRef,
  eventSequenceRef,
  firestorePathId,
  runRef,
  sessionRef,
} from "./paths.js";

function context() {
  const client = new FakeFirestore();
  return {
    client: client as unknown as Firestore,
    fake: client,
    maxChunkBytes: 128,
  };
}

describe("paths", () => {
  it("hashes path-derived identifiers", () => {
    expect(firestorePathId("weather/london")).toMatch(/^[a-f0-9]{64}$/);
    expect(firestorePathId("weather/london")).not.toBe(
      firestorePathId("weather/paris"),
    );
  });

  it("builds run, event, evaluation, and session references", () => {
    const { client } = context();
    expect(runRef(client, "run-1").path).toBe("evalRuns/run-1");
    expect(eventRef(client, "run-1", "event-1").path).toBe(
      "evalRuns/run-1/events/event-1",
    );
    expect(evaluationRef(client, "run-1", "weather/london").path).toBe(
      `evalRuns/run-1/evaluations/${firestorePathId("weather/london")}`,
    );
    expect(sessionRef(client, "run-1", "session-1").path).toBe(
      `evalRuns/run-1/sessions/${firestorePathId("session-1")}`,
    );
    expect(eventSequenceRef(client, "run-1", 3).path).toBe(
      "evalRuns/run-1/eventSequences/3",
    );
  });

  it("commits writes in batches of the configured size", async () => {
    const adapterContext = context();
    const empty = await commitInBatches(adapterContext, []);
    expect(empty).toBeUndefined();

    const writes = Array.from({ length: MAX_BATCH_WRITES + 1 }, (_, index) => ({
      reference: runRef(adapterContext.client, `run-${index}`),
      data: { index },
    }));
    await commitInBatches(adapterContext, writes);
    expect(adapterContext.fake.store.size).toBe(MAX_BATCH_WRITES + 1);
    expect(
      adapterContext.fake.store.get(`evalRuns/run-${MAX_BATCH_WRITES}`),
    ).toEqual({ index: MAX_BATCH_WRITES });
  });
});
