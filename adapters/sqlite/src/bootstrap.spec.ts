import { describe, expect, it } from "vitest";
import { applySqliteSchema, SQLITE_SCHEMA_SQL } from "./bootstrap.js";

describe("applySqliteSchema", () => {
  it("enables foreign keys and applies each statement", async () => {
    const statements: string[] = [];
    await applySqliteSchema({
      execute: async (statement: string) => {
        statements.push(statement);
      },
    } as never);

    expect(statements[0]).toBe("PRAGMA foreign_keys = ON");
    expect(statements.some((sql) => sql.includes("CREATE TABLE"))).toBe(true);
    expect(SQLITE_SCHEMA_SQL).toContain("events_run_sequence_idx");
  });
});
