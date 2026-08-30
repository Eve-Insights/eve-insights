import { createHash, randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { afterAll, describe, expect, it } from "vitest";
import { clearMysqlPoolCache, getMysqlPool, MysqlAdapter } from "./adapter.js";

const hasMysql = process.env.MYSQL_HOST !== undefined;
const port = Number(process.env.MYSQL_PORT ?? 3306);
const pool = hasMysql
  ? getMysqlPool({
      host: process.env.MYSQL_HOST ?? "127.0.0.1",
      user: process.env.MYSQL_USER ?? "eve",
      password: process.env.MYSQL_PASSWORD ?? "secret",
      database: process.env.MYSQL_DATABASE ?? "eve_insights",
      port,
      maxChunkBytes: 262_144,
    })
  : undefined;

afterAll(async () => {
  await pool?.end();
  clearMysqlPoolCache();
});

describe.skipIf(!hasMysql)("MySQL integration", () => {
  it("persists a run and commits a verified payload", async () => {
    if (pool === undefined) throw new Error("MySQL is not configured.");
    const database = drizzle(pool, { mode: "default" });
    await migrate(database, {
      migrationsFolder: new URL(
        "../../../databases/mysql/migrations",
        import.meta.url,
      ).pathname,
    });

    const adapter = new MysqlAdapter({
      host: process.env.MYSQL_HOST ?? "127.0.0.1",
      user: process.env.MYSQL_USER ?? "eve",
      password: process.env.MYSQL_PASSWORD ?? "secret",
      database: process.env.MYSQL_DATABASE ?? "eve_insights",
      port,
    });
    const runId = `integration-${randomUUID()}`;
    const eventId = randomUUID();
    const startedAt = new Date().toISOString();
    const bytes = Buffer.from("mysql payload");

    await expect(
      adapter.createRun({
        runId,
        startedAt,
        target: {
          agentId: "33333333-3333-5333-8333-333333333333",
          kind: "local",
          url: "http://localhost:3002",
          name: "Integration Agent",
          capabilities: { devRoutes: true },
        },
        evaluations: [{ id: "integration/eval" }],
      }),
    ).resolves.toEqual({ created: true });
    await adapter.beginEvent({
      runId,
      eventId,
      sequence: 0,
      type: "run.completed",
      occurredAt: startedAt,
      projection: {
        run: {
          status: "completed",
          completedAt: startedAt,
          counts: {
            total: 1,
            passed: 1,
            failed: 0,
            scored: 0,
            skipped: 0,
            errored: 0,
          },
        },
      },
      payload: {
        encoding: "gzip",
        contentType: "application/json",
        byteLength: bytes.length,
        chunkSize: bytes.length,
        chunkCount: 1,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    });
    await adapter.writeEventChunk({
      runId,
      eventId,
      index: 0,
      data: bytes.toString("base64"),
    });

    await expect(adapter.commitEvent({ runId, eventId })).resolves.toEqual({
      committed: true,
    });
    await expect(adapter.commitEvent({ runId, eventId })).resolves.toEqual({
      committed: false,
    });
  });
});
