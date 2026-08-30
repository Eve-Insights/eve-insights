CREATE TABLE IF NOT EXISTS runs (
  run_id VARCHAR(256) NOT NULL,
  agent_id VARCHAR(256) NOT NULL,
  started_at VARCHAR(64) NOT NULL,
  kind VARCHAR(16) NOT NULL,
  url TEXT NOT NULL,
  name VARCHAR(256) NOT NULL,
  capabilities JSON NOT NULL,
  status VARCHAR(16) NOT NULL,
  evaluation_count INT UNSIGNED NOT NULL,
  counts JSON NOT NULL,
  last_event_sequence INT NOT NULL DEFAULT -1,
  completed_at VARCHAR(64) NULL,
  PRIMARY KEY (run_id),
  INDEX runs_agent_started_idx (agent_id, started_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS evaluations (
  run_id VARCHAR(256) NOT NULL,
  evaluation_id VARCHAR(256) NOT NULL,
  description TEXT NULL,
  tags JSON NULL,
  timeout_ms INT UNSIGNED NULL,
  status VARCHAR(16) NOT NULL,
  started_at VARCHAR(64) NULL,
  completed_at VARCHAR(64) NULL,
  verdict VARCHAR(16) NULL,
  error TEXT NULL,
  skip_reason TEXT NULL,
  assertion_count INT UNSIGNED NULL,
  passed_assertion_count INT UNSIGNED NULL,
  failed_assertion_count INT UNSIGNED NULL,
  PRIMARY KEY (run_id, evaluation_id),
  CONSTRAINT evaluations_run_fk
    FOREIGN KEY (run_id) REFERENCES runs (run_id) ON DELETE NO ACTION
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS events (
  run_id VARCHAR(256) NOT NULL,
  event_id VARCHAR(256) NOT NULL,
  sequence INT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL,
  occurred_at VARCHAR(64) NOT NULL,
  projection JSON NOT NULL,
  payload_encoding VARCHAR(16) NOT NULL,
  payload_content_type VARCHAR(128) NOT NULL,
  payload_byte_length INT UNSIGNED NOT NULL,
  payload_chunk_size INT UNSIGNED NOT NULL,
  payload_chunk_count INT UNSIGNED NOT NULL,
  payload_sha256 CHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL,
  committed_at VARCHAR(64) NULL,
  PRIMARY KEY (run_id, event_id),
  CONSTRAINT events_run_fk
    FOREIGN KEY (run_id) REFERENCES runs (run_id) ON DELETE NO ACTION,
  INDEX events_run_status_idx (run_id, status),
  UNIQUE INDEX events_run_sequence_idx (run_id, sequence)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS event_chunks (
  run_id VARCHAR(256) NOT NULL,
  event_id VARCHAR(256) NOT NULL,
  chunk_index INT UNSIGNED NOT NULL,
  data MEDIUMTEXT NOT NULL,
  byte_length INT UNSIGNED NOT NULL,
  PRIMARY KEY (run_id, event_id, chunk_index),
  CONSTRAINT chunks_event_fk
    FOREIGN KEY (run_id, event_id) REFERENCES events (run_id, event_id)
    ON DELETE NO ACTION
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  run_id VARCHAR(256) NOT NULL,
  session_id VARCHAR(256) NOT NULL,
  evaluation_id VARCHAR(256) NOT NULL,
  is_primary BOOLEAN NOT NULL,
  started_at VARCHAR(64) NOT NULL,
  trace_context JSON NULL,
  PRIMARY KEY (run_id, session_id),
  CONSTRAINT sessions_run_fk
    FOREIGN KEY (run_id) REFERENCES runs (run_id) ON DELETE NO ACTION
) ENGINE=InnoDB;
