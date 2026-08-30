import { DatabaseKind } from "@eve-insights/adapter-types";
import { describe, expect, it } from "vitest";
import { supabaseEnvSchema } from "./env.js";

describe("supabaseEnvSchema", () => {
  it("requires the supabase kind, url, and secret key", () => {
    expect(() => supabaseEnvSchema.parse({})).toThrow();
    expect(() =>
      supabaseEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.SUPABASE,
        SUPABASE_URL: "",
        SUPABASE_SECRET_KEY: "secret",
      }),
    ).toThrow();
    expect(() =>
      supabaseEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.MYSQL,
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SECRET_KEY: "secret",
      }),
    ).toThrow();
  });

  it("accepts the marketplace url and secret key", () => {
    expect(
      supabaseEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.SUPABASE,
        SUPABASE_URL: " https://example.supabase.co ",
        SUPABASE_SECRET_KEY: " secret-key ",
      }),
    ).toEqual({
      EVE_INSIGHTS_DATABASE: DatabaseKind.SUPABASE,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: "secret-key",
    });
  });
});
