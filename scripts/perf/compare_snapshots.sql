-- Usage (psql):
-- \set baseline 'baseline_2026_02_28'
-- \set candidate 'after_phase3_2026_02_28'
-- \i scripts/perf/compare_snapshots.sql

WITH b AS (
  SELECT
    queryid,
    MAX(calls) AS calls,
    MAX(total_exec_time) AS total_exec_time,
    MAX(mean_exec_time) AS mean_exec_time,
    MAX(rows) AS rows,
    MIN(query) AS query
  FROM perf_query_snapshots
  WHERE run_label = :'baseline'
  GROUP BY queryid
),
c AS (
  SELECT
    queryid,
    MAX(calls) AS calls,
    MAX(total_exec_time) AS total_exec_time,
    MAX(mean_exec_time) AS mean_exec_time,
    MAX(rows) AS rows,
    MIN(query) AS query
  FROM perf_query_snapshots
  WHERE run_label = :'candidate'
  GROUP BY queryid
)
SELECT
  COALESCE(c.queryid, b.queryid) AS queryid,
  COALESCE(c.calls, 0) - COALESCE(b.calls, 0) AS delta_calls,
  ROUND((COALESCE(c.total_exec_time, 0) - COALESCE(b.total_exec_time, 0))::numeric, 2) AS delta_total_ms,
  ROUND((COALESCE(c.mean_exec_time, 0) - COALESCE(b.mean_exec_time, 0))::numeric, 2) AS delta_avg_ms,
  (COALESCE(c.rows, 0) - COALESCE(b.rows, 0)) AS delta_rows,
  LEFT(COALESCE(c.query, b.query), 300) AS sample_query
FROM b
FULL OUTER JOIN c ON c.queryid = b.queryid
ORDER BY delta_total_ms DESC
LIMIT 100;
