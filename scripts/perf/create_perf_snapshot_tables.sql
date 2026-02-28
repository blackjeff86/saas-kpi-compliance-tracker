-- Requires: pg_stat_statements enabled in the database.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS perf_query_snapshots (
  id bigserial PRIMARY KEY,
  run_label text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  userid oid NOT NULL,
  dbid oid NOT NULL,
  queryid bigint NOT NULL,
  calls bigint NOT NULL,
  total_exec_time double precision NOT NULL,
  mean_exec_time double precision NOT NULL,
  rows bigint NOT NULL,
  query text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_perf_query_snapshots_label_time
  ON perf_query_snapshots (run_label, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_perf_query_snapshots_queryid
  ON perf_query_snapshots (queryid);
