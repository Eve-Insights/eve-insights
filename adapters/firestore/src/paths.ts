import { createHash } from "node:crypto";
import type { DocumentReference, Firestore } from "@google-cloud/firestore";
import { MAX_BATCH_WRITES } from "./constants.js";
import type { AdapterContext } from "./types.js";

function hashPathId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const firestorePathId = hashPathId;

export function runRef(client: Firestore, runId: string): DocumentReference {
  return client.collection("evalRuns").doc(runId);
}

export function eventRef(
  client: Firestore,
  runId: string,
  eventId: string,
): DocumentReference {
  return runRef(client, runId).collection("events").doc(eventId);
}

export function eventSequenceRef(
  client: Firestore,
  runId: string,
  sequence: number,
): DocumentReference {
  return runRef(client, runId)
    .collection("eventSequences")
    .doc(String(sequence));
}

export function evaluationRef(
  client: Firestore,
  runId: string,
  evaluationId: string,
): DocumentReference {
  return runRef(client, runId)
    .collection("evaluations")
    .doc(hashPathId(evaluationId));
}

export function sessionRef(
  client: Firestore,
  runId: string,
  sessionId: string,
): DocumentReference {
  return runRef(client, runId)
    .collection("sessions")
    .doc(hashPathId(sessionId));
}

export interface FirestoreWrite {
  readonly reference: DocumentReference;
  readonly data: Record<string, unknown>;
}

export async function commitInBatches(
  context: AdapterContext,
  writes: readonly FirestoreWrite[],
): Promise<void> {
  for (let offset = 0; offset < writes.length; offset += MAX_BATCH_WRITES) {
    const batch = context.client.batch();
    for (const write of writes.slice(offset, offset + MAX_BATCH_WRITES)) {
      batch.set(write.reference, write.data);
    }
    await batch.commit();
  }
}
