-- Eve Insights persistence schema for the local PostgREST emulator
-- and for a hosted Supabase project. Timestamps are stored as ISO text
-- so idempotent replays compare the exact reporter string.

CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
GRANT anon, service_role TO postgres;

CREATE TABLE eval_runs (
  run_id text PRIMARY KEY,
  agent_id text NOT NULL,
  started_at text NOT NULL,
  kind text NOT NULL,
  url text NOT NULL,
  name text NOT NULL,
  capabilities jsonb NOT NULL,
  status text NOT NULL,
  evaluation_count integer NOT NULL,
  counts jsonb NOT NULL,
  last_event_sequence integer NOT NULL,
  completed_at text
);

CREATE INDEX eval_runs_agent_id_idx ON eval_runs (agent_id);

CREATE TABLE evaluations (
  run_id text NOT NULL REFERENCES eval_runs (run_id) ON DELETE CASCADE,
  evaluation_id text NOT NULL,
  description text,
  tags text[],
  timeout_ms integer,
  status text NOT NULL,
  started_at text,
  completed_at text,
  verdict text,
  error text,
  skip_reason text,
  assertion_count integer,
  passed_assertion_count integer,
  failed_assertion_count integer,
  PRIMARY KEY (run_id, evaluation_id)
);

CREATE TABLE sessions (
  run_id text NOT NULL REFERENCES eval_runs (run_id) ON DELETE CASCADE,
  session_id text NOT NULL,
  evaluation_id text NOT NULL,
  is_primary boolean NOT NULL,
  started_at text NOT NULL,
  trace_context jsonb,
  PRIMARY KEY (run_id, session_id)
);

CREATE TABLE events (
  run_id text NOT NULL REFERENCES eval_runs (run_id) ON DELETE CASCADE,
  event_id text NOT NULL,
  sequence integer NOT NULL,
  type text NOT NULL,
  occurred_at text NOT NULL,
  projection jsonb NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL,
  committed_at text,
  PRIMARY KEY (run_id, event_id)
);

CREATE UNIQUE INDEX events_run_sequence_idx ON events (run_id, sequence);

CREATE TABLE event_chunks (
  run_id text NOT NULL,
  event_id text NOT NULL,
  index integer NOT NULL,
  data text NOT NULL,
  byte_length integer NOT NULL,
  PRIMARY KEY (run_id, event_id, index),
  FOREIGN KEY (run_id, event_id) REFERENCES events (run_id, event_id) ON DELETE CASCADE
);

ALTER TABLE eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_chunks ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
