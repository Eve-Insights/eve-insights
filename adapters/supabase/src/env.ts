import { DatabaseKind } from "@eve-insights/adapter-types";
import { z } from "zod";

export const supabaseEnvSchema = z.compile(
  z.object({
    EVE_INSIGHTS_DATABASE: z.literal(DatabaseKind.SUPABASE),
    SUPABASE_URL: z.string().trim().min(1),
    SUPABASE_SECRET_KEY: z.string().trim().min(1),
  }),
);

export type SupabaseEnv = z.output<typeof supabaseEnvSchema>;
