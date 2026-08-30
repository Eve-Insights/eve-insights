import {
  boolean,
  char,
  foreignKey,
  index,
  int,
  json,
  mediumtext,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const runs = mysqlTable(
  "runs",
  {
    runId: varchar("run_id", { length: 256 }).notNull(),
    agentId: varchar("agent_id", { length: 256 }).notNull(),
    startedAt: varchar("started_at", { length: 64 }).notNull(),
    kind: varchar("kind", { length: 16 }).notNull(),
    url: text("url").notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    capabilities: json("capabilities").notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    evaluationCount: int("evaluation_count", { unsigned: true }).notNull(),
    counts: json("counts").notNull(),
    lastEventSequence: int("last_event_sequence").notNull().default(-1),
    completedAt: varchar("completed_at", { length: 64 }),
  },
  (table) => ({
    primary: primaryKey({ columns: [table.runId] }),
    agentStarted: index("runs_agent_started_idx").on(
      table.agentId,
      table.startedAt,
    ),
  }),
);

export const evaluations = mysqlTable(
  "evaluations",
  {
    runId: varchar("run_id", { length: 256 }).notNull(),
    evaluationId: varchar("evaluation_id", { length: 256 }).notNull(),
    description: text("description"),
    tags: json("tags"),
    timeoutMs: int("timeout_ms", { unsigned: true }),
    status: varchar("status", { length: 16 }).notNull(),
    startedAt: varchar("started_at", { length: 64 }),
    completedAt: varchar("completed_at", { length: 64 }),
    verdict: varchar("verdict", { length: 16 }),
    error: text("error"),
    skipReason: text("skip_reason"),
    assertionCount: int("assertion_count", { unsigned: true }),
    passedAssertionCount: int("passed_assertion_count", { unsigned: true }),
    failedAssertionCount: int("failed_assertion_count", { unsigned: true }),
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

export const events = mysqlTable(
  "events",
  {
    runId: varchar("run_id", { length: 256 }).notNull(),
    eventId: varchar("event_id", { length: 256 }).notNull(),
    sequence: int("sequence", { unsigned: true }).notNull(),
    type: varchar("type", { length: 32 }).notNull(),
    occurredAt: varchar("occurred_at", { length: 64 }).notNull(),
    projection: json("projection").notNull(),
    payloadEncoding: varchar("payload_encoding", { length: 16 }).notNull(),
    payloadContentType: varchar("payload_content_type", {
      length: 128,
    }).notNull(),
    payloadByteLength: int("payload_byte_length", {
      unsigned: true,
    }).notNull(),
    payloadChunkSize: int("payload_chunk_size", { unsigned: true }).notNull(),
    payloadChunkCount: int("payload_chunk_count", { unsigned: true }).notNull(),
    payloadSha256: char("payload_sha256", { length: 64 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    committedAt: varchar("committed_at", { length: 64 }),
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

export const eventChunks = mysqlTable(
  "event_chunks",
  {
    runId: varchar("run_id", { length: 256 }).notNull(),
    eventId: varchar("event_id", { length: 256 }).notNull(),
    chunkIndex: int("chunk_index", { unsigned: true }).notNull(),
    data: mediumtext("data").notNull(),
    byteLength: int("byte_length", { unsigned: true }).notNull(),
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

export const sessions = mysqlTable(
  "sessions",
  {
    runId: varchar("run_id", { length: 256 }).notNull(),
    sessionId: varchar("session_id", { length: 256 }).notNull(),
    evaluationId: varchar("evaluation_id", { length: 256 }).notNull(),
    isPrimary: boolean("is_primary").notNull(),
    startedAt: varchar("started_at", { length: 64 }).notNull(),
    traceContext: json("trace_context"),
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

export const mysqlSchema = {
  runs,
  evaluations,
  events,
  eventChunks,
  sessions,
};
