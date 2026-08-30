import { DatabaseKind } from "@eve-insights/adapter-types";
import { describe, expect, it } from "vitest";
import { mysqlEnvSchema } from "./env.js";

describe("mysqlEnvSchema", () => {
  it("requires the MySQL connection fields", () => {
    expect(() =>
      mysqlEnvSchema.parse({ EVE_INSIGHTS_DATABASE: DatabaseKind.MYSQL }),
    ).toThrow();
  });

  it("trims connection fields and accepts an optional port", () => {
    expect(
      mysqlEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.MYSQL,
        MYSQL_HOST: " 127.0.0.1 ",
        MYSQL_USER: " eve ",
        MYSQL_PASSWORD: "secret",
        MYSQL_DATABASE: " eve_insights ",
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

  it("rejects an environment selected for another database", () => {
    expect(() =>
      mysqlEnvSchema.parse({
        EVE_INSIGHTS_DATABASE: DatabaseKind.FIRESTORE,
        MYSQL_HOST: "127.0.0.1",
        MYSQL_USER: "eve",
        MYSQL_PASSWORD: "secret",
        MYSQL_DATABASE: "eve_insights",
      }),
    ).toThrow();
  });
});
