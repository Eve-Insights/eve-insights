// @vitest-environment node

import { DatabaseKind } from "@eve-insights/adapter-types";
import { describe, expect, it } from "vitest";
import {
  databaseEnvSchema,
  mysqlEnvSchema,
  postgresEnvSchema,
  sqliteEnvSchema,
  supabaseEnvSchema,
} from "./database";

describe("mysqlEnvSchema", () => {
  it("requires host, user, password, and database", () => {
    expect(() =>
      mysqlEnvSchema.parse({ EVE_INSIGHTS_DATABASE: DatabaseKind.MYSQL }),
    ).toThrow();
    expect(
      mysqlEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.MYSQL,
        MYSQL_HOST: " 127.0.0.1 ",
        MYSQL_USER: "eve",
        MYSQL_PASSWORD: "secret",
        MYSQL_DATABASE: "eve_insights",
        MYSQL_PORT: "3306",
      }),
    ).toEqual({
      EVE_INSIGHTS_DATABASE: DatabaseKind.MYSQL,
      MYSQL_HOST: "127.0.0.1",
      MYSQL_USER: "eve",
      MYSQL_PASSWORD: "secret",
      MYSQL_DATABASE: "eve_insights",
      MYSQL_PORT: "3306",
    });
  });
});

describe("postgresEnvSchema", () => {
  it("requires host, user, password, and database", () => {
    expect(() =>
      postgresEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.POSTGRES,
      }),
    ).toThrow();
    expect(
      postgresEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.POSTGRES,
        POSTGRES_HOST: " 127.0.0.1 ",
        POSTGRES_USER: "eve",
        POSTGRES_PASSWORD: "secret",
        POSTGRES_DATABASE: "eve_insights",
      }),
    ).toEqual({
      EVE_INSIGHTS_DATABASE: DatabaseKind.POSTGRES,
      POSTGRES_HOST: "127.0.0.1",
      POSTGRES_USER: "eve",
      POSTGRES_PASSWORD: "secret",
      POSTGRES_DATABASE: "eve_insights",
    });
  });
});

describe("sqliteEnvSchema", () => {
  it("requires a database path", () => {
    expect(() =>
      sqliteEnvSchema.parse({ EVE_INSIGHTS_DATABASE: DatabaseKind.SQLITE }),
    ).toThrow();
    expect(
      sqliteEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.SQLITE,
        SQLITE_PATH: " ./data/eve_insights.db ",
      }),
    ).toEqual({
      EVE_INSIGHTS_DATABASE: DatabaseKind.SQLITE,
      SQLITE_PATH: "./data/eve_insights.db",
    });
  });

  it("rejects an environment selected for another database", () => {
    expect(() =>
      sqliteEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.FIRESTORE,
        SQLITE_PATH: "./data/eve_insights.db",
      }),
    ).toThrow();
  });
});

describe("supabaseEnvSchema", () => {
  it("requires the marketplace url and secret key", () => {
    expect(() =>
      supabaseEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.SUPABASE,
      }),
    ).toThrow();
    expect(
      supabaseEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.SUPABASE,
        SUPABASE_URL: " https://example.supabase.co ",
        SUPABASE_SECRET_KEY: "secret-key",
      }),
    ).toEqual({
      EVE_INSIGHTS_DATABASE: DatabaseKind.SUPABASE,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: "secret-key",
    });
  });
});

describe("databaseEnvSchema", () => {
  it("parses firestore vars when firestore is selected", () => {
    expect(
      databaseEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.FIRESTORE,
        FIREBASE_PROJECT_ID: "eve-insights",
        FIRESTORE_EMULATOR_HOST: "localhost:8080",
      }),
    ).toEqual({
      EVE_INSIGHTS_DATABASE: DatabaseKind.FIRESTORE,
      FIREBASE_PROJECT_ID: "eve-insights",
      FIRESTORE_EMULATOR_HOST: "localhost:8080",
    });
  });

  it("parses mysql vars when mysql is selected", () => {
    expect(
      databaseEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.MYSQL,
        MYSQL_HOST: "127.0.0.1",
        MYSQL_USER: "eve",
        MYSQL_PASSWORD: "secret",
        MYSQL_DATABASE: "eve_insights",
      }),
    ).toEqual({
      EVE_INSIGHTS_DATABASE: DatabaseKind.MYSQL,
      MYSQL_HOST: "127.0.0.1",
      MYSQL_USER: "eve",
      MYSQL_PASSWORD: "secret",
      MYSQL_DATABASE: "eve_insights",
    });
  });

  it("parses sqlite vars when sqlite is selected", () => {
    expect(
      databaseEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.SQLITE,
        SQLITE_PATH: "./data/eve_insights.db",
      }),
    ).toEqual({
      EVE_INSIGHTS_DATABASE: DatabaseKind.SQLITE,
      SQLITE_PATH: "./data/eve_insights.db",
    });
  });

  it("parses supabase vars when supabase is selected", () => {
    expect(
      databaseEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.SUPABASE,
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SECRET_KEY: "secret-key",
      }),
    ).toEqual({
      EVE_INSIGHTS_DATABASE: DatabaseKind.SUPABASE,
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SECRET_KEY: "secret-key",
    });
  });

  it("fails when firestore is selected without a project id", () => {
    expect(() =>
      databaseEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.FIRESTORE,
      }),
    ).toThrow();
  });

  it("rejects an unknown selector", () => {
    expect(() =>
      databaseEnvSchema.parse({ EVE_INSIGHTS_DATABASE: "mongo" }),
    ).toThrow();
  });
});
