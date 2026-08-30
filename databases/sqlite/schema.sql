CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  status TEXT NOT NULL,
  evaluation_count INTEGER NOT NULL,
  counts TEXT NOT NULL,
  last_event_sequence INTEGER NOT NULL DEFAULT -1,
  completed_at TEXT,
  PRIMARY KEY (run_id)
);

CREATE INDEX IF NOT EXISTS runs_agent_started_idx ON runs (agent_id, started_at);

CREATE TABLE IF NOT EXISTS evaluations (
  run_id TEXT NOT NULL,
  evaluation_id TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  timeout_ms INTEGER,
  status TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  verdict TEXT,
  error TEXT,
  skip_reason TEXT,
  assertion_count INTEGER,
  passed_assertion_count INTEGER,
  failed_assertion_count INTEGER,
  PRIMARY KEY (run_id, evaluation_id),
  CONSTRAINT evaluations_run_fk
    FOREIGN KEY (run_id) REFERENCES runs (run_id) ON DELETE NO ACTION
);

CREATE TABLE IF NOT EXISTS events (
  run_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  projection TEXT NOT NULL,
  payload_encoding TEXT NOT NULL,
  payload_content_type TEXT NOT NULL,
  payload_byte_length INTEGER NOT NULL,
  payload_chunk_size INTEGER NOT NULL,
  payload_chunk_count INTEGER NOT NULL,
  payload_sha256 TEXT NOT NULL,
  status TEXT NOT NULL,
  committed_at TEXT,
  PRIMARY KEY (run_id, event_id),
  CONSTRAINT events_run_fk
    FOREIGN KEY (run_id) REFERENCES runs (run_id) ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS events_run_status_idx ON events (run_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS events_run_sequence_idx ON events (run_id, sequence);

CREATE TABLE IF NOT EXISTS event_chunks (
  run_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  PRIMARY KEY (run_id, event_id, chunk_index),
  CONSTRAINT chunks_event_fk
    FOREIGN KEY (run_id, event_id) REFERENCES events (run_id, event_id)
    ON DELETE NO ACTION
);

CREATE TABLE IF NOT EXISTS sessions (
  run_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  evaluation_id TEXT NOT NULL,
  is_primary INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  trace_context TEXT,
  PRIMARY KEY (run_id, session_id),
  CONSTRAINT sessions_run_fk
    FOREIGN KEY (run_id) REFERENCES runs (run_id) ON DELETE NO ACTION
);
