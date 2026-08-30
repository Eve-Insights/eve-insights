// @vitest-environment node

import { FirestoreAdapter } from "@eve-insights/adapter-firestore";
import { MysqlAdapter } from "@eve-insights/adapter-mysql";
import { SqliteAdapter } from "@eve-insights/adapter-sqlite";
import { SupabaseAdapter } from "@eve-insights/adapter-supabase";
import { DatabaseKind } from "@eve-insights/adapter-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDatabaseCache, getDatabase } from "./index";

vi.mock("@eve-insights/adapter-firestore", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@eve-insights/adapter-firestore")>();
  return {
    ...actual,
    FirestoreAdapter: vi.fn(),
  };
});

vi.mock("@eve-insights/adapter-mysql", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@eve-insights/adapter-mysql")>();
  return {
    ...actual,
    MysqlAdapter: vi.fn(),
  };
});

vi.mock("@eve-insights/adapter-sqlite", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@eve-insights/adapter-sqlite")>();
  return {
    ...actual,
    SqliteAdapter: vi.fn(),
  };
});

vi.mock("@eve-insights/adapter-supabase", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@eve-insights/adapter-supabase")>();
  return {
    ...actual,
    SupabaseAdapter: vi.fn(),
  };
});

describe("getDatabase", () => {
  afterEach(() => {
    clearDatabaseCache();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("constructs a firestore adapter from env", async () => {
    vi.stubEnv("EVE_INSIGHTS_DATABASE", DatabaseKind.FIRESTORE);
    vi.stubEnv("FIREBASE_PROJECT_ID", "eve-insights");

    await getDatabase();
    await getDatabase();

    expect(FirestoreAdapter).toHaveBeenCalledTimes(1);
    expect(FirestoreAdapter).toHaveBeenCalledWith({
      projectId: "eve-insights",
    });
  });

  it("constructs a supabase adapter from env", async () => {
    vi.stubEnv("EVE_INSIGHTS_DATABASE", DatabaseKind.SUPABASE);
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_SECRET_KEY", "secret-key");

    await getDatabase();

    expect(SupabaseAdapter).toHaveBeenCalledWith({
      url: "http://127.0.0.1:54321",
      secretKey: "secret-key",
    });
  });

  it("constructs a mysql adapter from env", async () => {
    vi.stubEnv("EVE_INSIGHTS_DATABASE", DatabaseKind.MYSQL);
    vi.stubEnv("MYSQL_HOST", "127.0.0.1");
    vi.stubEnv("MYSQL_USER", "eve");
    vi.stubEnv("MYSQL_PASSWORD", "secret");
    vi.stubEnv("MYSQL_DATABASE", "eve_insights");
    vi.stubEnv("MYSQL_PORT", "3306");

    await getDatabase();

    expect(MysqlAdapter).toHaveBeenCalledWith({
      host: "127.0.0.1",
      user: "eve",
      password: "secret",
      database: "eve_insights",
      port: "3306",
    });
  });

  it("constructs a sqlite adapter from env", async () => {
    vi.stubEnv("EVE_INSIGHTS_DATABASE", DatabaseKind.SQLITE);
    vi.stubEnv("SQLITE_PATH", "./data/eve_insights.db");

    await getDatabase();

    expect(SqliteAdapter).toHaveBeenCalledWith({
      path: "./data/eve_insights.db",
    });
  });

  it("throws for an unimplemented adapter", async () => {
    vi.stubEnv("EVE_INSIGHTS_DATABASE", DatabaseKind.POSTGRES);
    vi.stubEnv("POSTGRES_HOST", "127.0.0.1");
    vi.stubEnv("POSTGRES_USER", "eve");
    vi.stubEnv("POSTGRES_PASSWORD", "secret");
    vi.stubEnv("POSTGRES_DATABASE", "eve_insights");

    await expect(getDatabase()).rejects.toThrow(
      "The 'postgres' Eve Insights database adapter is not implemented yet.",
    );
  });

  it("rejects env that does not match a database kind", async () => {
    vi.stubEnv("EVE_INSIGHTS_DATABASE", "mongo");

    await expect(getDatabase()).rejects.toThrow();
  });
});
