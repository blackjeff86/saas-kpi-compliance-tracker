-- Top expensive statements now (requires pg_stat_statements).

SELECT
  calls,
  ROUND(total_exec_time::numeric, 2) AS total_ms,
  ROUND((total_exec_time / NULLIF(calls, 0))::numeric, 2) AS avg_ms,
  rows,
  LEFT(query, 300) AS sample_query
FROM pg_stat_statements
WHERE
  query ILIKE '%action_plans%'
  OR query ILIKE '%risk_catalog%'
  OR query ILIKE '%controls%'
  OR query ILIKE '%kpi_executions%'
  OR query ILIKE '%tenant_permission_matrix%'
  OR query ILIKE '%team_members%'
  OR query ILIKE '%role_permissions%'
ORDER BY total_exec_time DESC
LIMIT 50;
