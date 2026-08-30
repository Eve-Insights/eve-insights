import { describe, expect, it } from "vitest";
import { mysqlAdapterOptionsSchema } from "./types.js";

describe("mysqlAdapterOptionsSchema", () => {
  it("normalizes connection options and applies defaults", () => {
    expect(
      mysqlAdapterOptionsSchema.parse({
        host: " 127.0.0.1 ",
        user: " eve ",
        password: "secret",
        database: " eve_insights ",
      }),
    ).toEqual({
      host: "127.0.0.1",
      user: "eve",
      password: "secret",
      database: "eve_insights",
      port: 3306,
      maxChunkBytes: 262_144,
    });
    expect(
      mysqlAdapterOptionsSchema.parse({
        host: "localhost",
        user: "eve",
        password: "secret",
        database: "eve_insights",
        port: "3307",
        maxChunkBytes: 128,
      }).port,
    ).toBe(3307);
  });

  it("rejects empty connection fields and invalid ports or chunk sizes", () => {
    expect(() =>
      mysqlAdapterOptionsSchema.parse({
        host: "",
        user: "eve",
        password: "secret",
        database: "eve_insights",
      }),
    ).toThrow();
    expect(() =>
      mysqlAdapterOptionsSchema.parse({
        host: "localhost",
        user: "eve",
        password: "secret",
        database: "eve_insights",
        port: 0,
      }),
    ).toThrow();
    expect(() =>
      mysqlAdapterOptionsSchema.parse({
        host: "localhost",
        user: "eve",
        password: "secret",
        database: "eve_insights",
        maxChunkBytes: 0,
      }),
    ).toThrow();
  });
});
