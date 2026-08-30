import { DatabaseAdapterError } from "@eve-insights/adapter-types";
import { describe, expect, it } from "vitest";
import { isUniqueViolation, throwUnexpected } from "./errors.js";

describe("errors", () => {
  it("recognizes PostgreSQL unique violations", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "other" })).toBe(false);
    expect(isUniqueViolation({})).toBe(false);
  });

  it("maps unexpected Supabase errors to unavailable adapter errors", () => {
    expect(() =>
      throwUnexpected({ message: "connection refused" }),
    ).toThrowError(
      new DatabaseAdapterError("unavailable", "connection refused"),
    );
    expect(() => throwUnexpected({ message: "" })).toThrowError(
      new DatabaseAdapterError("unavailable", "Supabase request failed."),
    );
    expect(() => throwUnexpected({})).toThrowError(
      new DatabaseAdapterError("unavailable", "Supabase request failed."),
    );
  });
});
