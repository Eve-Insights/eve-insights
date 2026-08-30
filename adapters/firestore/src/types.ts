import type { Firestore } from "@google-cloud/firestore";
import { z } from "zod";
import { MAX_CHUNK_BYTES } from "./constants.js";

export const firestoreAdapterOptionsSchema = z.compile(
  z.object({
    projectId: z.string().min(1),
    maxChunkBytes: z
      .number()
      .int()
      .min(1)
      .max(MAX_CHUNK_BYTES)
      .default(MAX_CHUNK_BYTES),
  }),
);

export type FirestoreAdapterOptions = z.input<
  typeof firestoreAdapterOptionsSchema
>;

export interface AdapterContext {
  readonly client: Firestore;
  readonly maxChunkBytes: number;
}
