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

export const mysqlEnvSchema = z.compile(
  z.object({
    EVE_INSIGHTS_DATABASE: z.literal(DatabaseKind.MYSQL),
    MYSQL_HOST: z.string().trim().min(1),
    MYSQL_USER: z.string().trim().min(1),
    MYSQL_PASSWORD: z.string().min(1),
    MYSQL_DATABASE: z.string().trim().min(1),
    MYSQL_PORT: z.string().trim().min(1).optional(),
  }),
);

export const postgresEnvSchema = z.compile(
  z.object({
    EVE_INSIGHTS_DATABASE: z.literal(DatabaseKind.POSTGRES),
    POSTGRES_HOST: z.string().trim().min(1),
    POSTGRES_USER: z.string().trim().min(1),
    POSTGRES_PASSWORD: z.string().min(1),
    POSTGRES_DATABASE: z.string().trim().min(1),
    POSTGRES_PORT: z.string().trim().min(1).optional(),
  }),
);

export const sqliteEnvSchema = z.compile(
  z.object({
    EVE_INSIGHTS_DATABASE: z.literal(DatabaseKind.SQLITE),
    SQLITE_PATH: z.string().trim().min(1),
  }),
);

export const supabaseEnvSchema = z.compile(
  z.object({
    EVE_INSIGHTS_DATABASE: z.literal(DatabaseKind.SUPABASE),
    SUPABASE_URL: z.string().trim().min(1),
    SUPABASE_SECRET_KEY: z.string().trim().min(1),
  }),
);

export const databaseEnvSchema = z.discriminatedUnion("EVE_INSIGHTS_DATABASE", [
  firestoreEnvSchema,
  mysqlEnvSchema,
  postgresEnvSchema,
  sqliteEnvSchema,
  supabaseEnvSchema,
]);

export type DatabaseEnv = z.output<typeof databaseEnvSchema>;
