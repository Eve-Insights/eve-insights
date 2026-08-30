import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  clearSqliteClientCache,
  getSqliteClient,
  SqliteAdapter,
} from "./adapter.js";

const dbPath = join(
  mkdtempSync(join(tmpdir(), "eve-insights-sqlite-")),
  "eve_insights.db",
);
const client = getSqliteClient({
  path: dbPath,
  maxChunkBytes: 262_144,
});
const schema = readFileSync(
  new URL("../../../databases/sqlite/schema.sql", import.meta.url),
  "utf8",
);

afterAll(() => {
  client.close();
  clearSqliteClientCache();
});

describe("SQLite integration", () => {
  it("persists a run and commits a verified payload", async () => {
    for (const statement of schema.split(";").map((part) => part.trim())) {
      if (statement !== "") await client.execute(statement);
    }

    const adapter = new SqliteAdapter({ path: dbPath });
    const runId = `integration-${randomUUID()}`;
    const eventId = randomUUID();
    const startedAt = new Date().toISOString();
    const bytes = Buffer.from("sqlite payload");

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
