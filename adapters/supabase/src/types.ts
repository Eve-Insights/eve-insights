import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { MAX_CHUNK_BYTES } from "./constants.js";

export const supabaseAdapterOptionsSchema = z.compile(
  z.object({
    url: z.string().min(1),
    secretKey: z.string().min(1),
    maxChunkBytes: z
      .number()
      .int()
      .min(1)
      .max(MAX_CHUNK_BYTES)
      .default(MAX_CHUNK_BYTES),
  }),
);

export type SupabaseAdapterOptions = z.input<
  typeof supabaseAdapterOptionsSchema
>;

export interface AdapterContext {
  readonly client: SupabaseClient;
  readonly maxChunkBytes: number;
}
