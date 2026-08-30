import { DatabaseKind } from "@eve-insights/adapter-types";
import { describe, expect, it } from "vitest";
import { firestoreEnvSchema } from "./env.js";

describe("env", () => {
  it("requires the firestore kind and project id", () => {
    expect(() => firestoreEnvSchema.parse({})).toThrow();
    expect(() =>
      firestoreEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.FIRESTORE,
        FIREBASE_PROJECT_ID: "",
      }),
    ).toThrow();
    expect(() =>
      firestoreEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.MYSQL,
        FIREBASE_PROJECT_ID: "eve-insights",
      }),
    ).toThrow();
  });

  it("accepts the required project id and optional client vars", () => {
    expect(
      firestoreEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.FIRESTORE,
        FIREBASE_PROJECT_ID: " eve-insights ",
      }),
    ).toEqual({
      EVE_INSIGHTS_DATABASE: DatabaseKind.FIRESTORE,
      FIREBASE_PROJECT_ID: "eve-insights",
    });
    expect(
      firestoreEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.FIRESTORE,
        FIREBASE_PROJECT_ID: "eve-insights",
        FIRESTORE_EMULATOR_HOST: "localhost:8080",
        GOOGLE_APPLICATION_CREDENTIALS: "/secrets/sa.json",
      }),
    ).toEqual({
      EVE_INSIGHTS_DATABASE: DatabaseKind.FIRESTORE,
      FIREBASE_PROJECT_ID: "eve-insights",
      FIRESTORE_EMULATOR_HOST: "localhost:8080",
      GOOGLE_APPLICATION_CREDENTIALS: "/secrets/sa.json",
    });
    expect(() =>
      firestoreEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.FIRESTORE,
        FIREBASE_PROJECT_ID: "eve-insights",
        FIRESTORE_EMULATOR_HOST: " ",
      }),
    ).toThrow();
    expect(() =>
      firestoreEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.FIRESTORE,
        FIREBASE_PROJECT_ID: "eve-insights",
        GOOGLE_APPLICATION_CREDENTIALS: " ",
      }),
    ).toThrow();
  });
});
