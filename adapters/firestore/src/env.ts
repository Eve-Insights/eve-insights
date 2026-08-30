import { DatabaseKind } from "@eve-insights/adapter-types";
import { z } from "zod";

export const firestoreEnvSchema = z.compile(
  z.object({
    EVE_INSIGHTS_DATABASE: z.literal(DatabaseKind.FIRESTORE),
    FIREBASE_PROJECT_ID: z.string().trim().min(1),
    FIRESTORE_EMULATOR_HOST: z.string().trim().min(1).optional(),
    GOOGLE_APPLICATION_CREDENTIALS: z.string().trim().min(1).optional(),
  }),
);

export type FirestoreEnv = z.output<typeof firestoreEnvSchema>;
