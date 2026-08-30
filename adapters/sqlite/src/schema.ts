import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const runs = sqliteTable(
  "runs",
  {
    runId: text("run_id").notNull(),
    agentId: text("agent_id").notNull(),
    startedAt: text("started_at").notNull(),
    kind: text("kind").notNull(),
    url: text("url").notNull(),
    name: text("name").notNull(),
    capabilities: text("capabilities", { mode: "json" }).notNull(),
    status: text("status").notNull(),
    evaluationCount: integer("evaluation_count").notNull(),
    counts: text("counts", { mode: "json" }).notNull(),
    lastEventSequence: integer("last_event_sequence").notNull().default(-1),
    completedAt: text("completed_at"),
  },
  (table) => ({
    primary: primaryKey({ columns: [table.runId] }),
    agentStarted: index("runs_agent_started_idx").on(
      table.agentId,
      table.startedAt,
    ),
  }),
);

export const evaluations = sqliteTable(
  "evaluations",
  {
    runId: text("run_id").notNull(),
    evaluationId: text("evaluation_id").notNull(),
    description: text("description"),
    tags: text("tags", { mode: "json" }),
    timeoutMs: integer("timeout_ms"),
    status: text("status").notNull(),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    verdict: text("verdict"),
    error: text("error"),
    skipReason: text("skip_reason"),
    assertionCount: integer("assertion_count"),
    passedAssertionCount: integer("passed_assertion_count"),
    failedAssertionCount: integer("failed_assertion_count"),
  },
  (table) => ({
    primary: primaryKey({ columns: [table.runId, table.evaluationId] }),
    run: foreignKey({
      name: "evaluations_run_fk",
      columns: [table.runId],
      foreignColumns: [runs.runId],
    }),
  }),
);

export const events = sqliteTable(
  "events",
  {
    runId: text("run_id").notNull(),
    eventId: text("event_id").notNull(),
    sequence: integer("sequence").notNull(),
    type: text("type").notNull(),
    occurredAt: text("occurred_at").notNull(),
    projection: text("projection", { mode: "json" }).notNull(),
    payloadEncoding: text("payload_encoding").notNull(),
    payloadContentType: text("payload_content_type").notNull(),
    payloadByteLength: integer("payload_byte_length").notNull(),
    payloadChunkSize: integer("payload_chunk_size").notNull(),
    payloadChunkCount: integer("payload_chunk_count").notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    status: text("status").notNull(),
    committedAt: text("committed_at"),
  },
  (table) => ({
    primary: primaryKey({ columns: [table.runId, table.eventId] }),
    runStatus: index("events_run_status_idx").on(table.runId, table.status),
    runSequence: uniqueIndex("events_run_sequence_idx").on(
      table.runId,
      table.sequence,
    ),
    run: foreignKey({
      name: "events_run_fk",
      columns: [table.runId],
      foreignColumns: [runs.runId],
    }),
  }),
);

export const eventChunks = sqliteTable(
  "event_chunks",
  {
    runId: text("run_id").notNull(),
    eventId: text("event_id").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    data: text("data").notNull(),
    byteLength: integer("byte_length").notNull(),
  },
  (table) => ({
    primary: primaryKey({
      columns: [table.runId, table.eventId, table.chunkIndex],
    }),
    event: foreignKey({
      name: "chunks_event_fk",
      columns: [table.runId, table.eventId],
      foreignColumns: [events.runId, events.eventId],
    }),
  }),
);

export const sessions = sqliteTable(
  "sessions",
  {
    runId: text("run_id").notNull(),
    sessionId: text("session_id").notNull(),
    evaluationId: text("evaluation_id").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull(),
    startedAt: text("started_at").notNull(),
    traceContext: text("trace_context", { mode: "json" }),
  },
  (table) => ({
    primary: primaryKey({ columns: [table.runId, table.sessionId] }),
    run: foreignKey({
      name: "sessions_run_fk",
      columns: [table.runId],
      foreignColumns: [runs.runId],
    }),
  }),
);

export const sqliteSchema = {
  runs,
  evaluations,
  events,
  eventChunks,
  sessions,
};
