-- Usage (psql):
-- \set run_label 'baseline_2026_02_28'
-- \i scripts/perf/capture_snapshot.sql
--
-- Optional:
-- \set app_like '%risk_catalog%'

INSERT INTO perf_query_snapshots (
  run_label,
  userid,
  dbid,
  queryid,
  calls,
  total_exec_time,
  mean_exec_time,
  rows,
  query
)
SELECT
  :'run_label'::text AS run_label,
  s.userid,
  s.dbid,
  s.queryid,
  s.calls,
  s.total_exec_time,
  s.mean_exec_time,
  s.rows,
  s.query
FROM pg_stat_statements s
WHERE
  s.query ILIKE '%action_plans%'
  OR s.query ILIKE '%risk_catalog%'
  OR s.query ILIKE '%controls%'
  OR s.query ILIKE '%kpi_executions%'
  OR s.query ILIKE '%tenant_permission_matrix%'
  OR s.query ILIKE '%team_members%'
  OR s.query ILIKE '%role_permissions%';
