// app/(app)/dashboard/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"
import { getDashboardScope } from "../lib/authz"
import { ensureTeamIdColumns } from "../lib/rbac-migrations"

export type DashboardFilters = {
  frameworks: Array<{ id: string; name: string }>
}

export type DashboardSummary = {
  filters: DashboardFilters

  cards: {
    controls_ok: number
    controls_overdue: number
    controls_critical: number
    kpis_out_of_target: number
  }

  counts: {
    executions_total: number
    executions_pending_grc: number
    action_plans_open: number
    action_plans_overdue: number
  }

  executions_by_workflow: Array<{ workflow_status: string; count: number }>
  executions_by_auto: Array<{ auto_status: string; count: number }>
  action_plans_by_priority: Array<{ priority: string; count: number }>

  action_plans_due_soon: Array<{
    id: string
    title: string
    priority: string
    status: string
    due_date: string
    execution_id: string
    control_code: string | null
    kpi_code: string | null
  }>

  recent_executions: Array<{
    id: string
    control_code: string
    kpi_code: string
    period_start: string
    period_end: string
    auto_status: string
    workflow_status: string
    created_at: string
  }>

  performance_6m: Array<{ month: string; pct_in_target: number }>
  critical_controls: Array<{
    control_id: string
    control_code: string
    control_name: string
    owner_name: string | null
    status_label: string
    status_kind: "danger" | "warning" | "info" | "neutral"
  }>
}

export type DashboardQuery = {
  frameworkId?: string | null // frameworks.id
  year?: number
  month?: number // 1..12
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0)) // next month
  const toDate = (d: Date) => d.toISOString().slice(0, 10)
  return { startDate: toDate(start), endDate: toDate(end) }
}

export async function fetchDashboardSummary(q: DashboardQuery = {}): Promise<DashboardSummary> {
  const ctx = await getContext()
  const tenantId = ctx.tenantId

  await ensureTeamIdColumns()
  const scope = await getDashboardScope(tenantId, ctx.userId)
  const teamIdsArr = scope.teamIds
  const noScope = scope.canViewAll || teamIdsArr.length === 0
  const oneTeam = !noScope && teamIdsArr.length === 1
  const firstTeamId = teamIdsArr[0] ?? ""
  const teamsArray = teamIdsArr as unknown as string

  const now = new Date()
  const year = Number.isFinite(q.year) ? (q.year as number) : now.getFullYear()
  const month = Number.isFinite(q.month) ? (q.month as number) : now.getMonth() + 1
  const frameworkId = (q.frameworkId || "").trim() || null

  const { startDate, endDate } = monthRange(year, month)

  // =========================
  // Filters (frameworks dropdown)
  // =========================
  const frameworksPromise = noScope
    ? sql<{ id: string; name: string }>`
        SELECT DISTINCT f.id::text AS id, f.name::text AS name
        FROM frameworks f
        JOIN controls c ON c.framework_id = f.id
        WHERE f.tenant_id = ${tenantId} AND c.tenant_id = ${tenantId}
        ORDER BY f.name ASC
      `
    : oneTeam
      ? sql<{ id: string; name: string }>`
          SELECT DISTINCT f.id::text AS id, f.name::text AS name
          FROM frameworks f
          JOIN controls c ON c.framework_id = f.id
          WHERE f.tenant_id = ${tenantId} AND c.tenant_id = ${tenantId}
            AND (c.team_id IS NULL OR c.team_id = ${firstTeamId}::uuid)
          ORDER BY f.name ASC
        `
      : sql<{ id: string; name: string }>`
          SELECT DISTINCT f.id::text AS id, f.name::text AS name
          FROM frameworks f
          JOIN controls c ON c.framework_id = f.id
          WHERE f.tenant_id = ${tenantId} AND c.tenant_id = ${tenantId}
            AND (c.team_id IS NULL OR c.team_id = ANY(${teamsArray}::uuid[]))
          ORDER BY f.name ASC
        `
  // =========================
  // Cards
  // =========================
  const cardsPromise = noScope
    ? sql<{
        controls_ok: number
        controls_overdue: number
        controls_critical: number
        kpis_out_of_target: number
      }>`
    WITH controls_base AS (
      SELECT c.id AS control_id, c.tenant_id, c.risk_id, c.owner_user_id, c.control_code, c.name, c.framework_id, c.frequency::text AS frequency_text, c.frequency_key::text AS frequency_key_text
      FROM controls c WHERE c.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid)
    ),
    controls_norm AS (
      SELECT cb.*, CASE WHEN cb.frequency_key_text IN ('quarterly','semiannual','annual') THEN cb.frequency_key_text
        WHEN lower(cb.frequency_text) ~ '(tri|trimes|quarter|q[1-4])' THEN 'quarterly'
        WHEN lower(cb.frequency_text) ~ '(semes|semi|half)' THEN 'semiannual'
        WHEN lower(cb.frequency_text) ~ '(anual|annual|year)' THEN 'annual'
        WHEN lower(cb.frequency_text) ~ '(mens|month)' THEN 'monthly'
        WHEN lower(cb.frequency_text) ~ '(seman|week|wk)' THEN 'monthly'
        WHEN lower(cb.frequency_text) ~ '(diar|day|d\\b)' THEN 'monthly'
        ELSE 'monthly' END AS freq_group
      FROM controls_base cb
    ),
    expected AS (
      SELECT cn.control_id, cn.freq_group,
        CASE WHEN cn.freq_group = 'monthly' THEN (date_trunc('month', CURRENT_DATE) - interval '1 day')::date
          WHEN cn.freq_group = 'quarterly' THEN (date_trunc('quarter', CURRENT_DATE) - interval '1 day')::date
          WHEN cn.freq_group = 'semiannual' THEN (CASE WHEN extract(month from CURRENT_DATE) <= 6 THEN (make_date(extract(year from CURRENT_DATE)::int, 1, 1) - interval '1 day')::date ELSE (make_date(extract(year from CURRENT_DATE)::int, 7, 1) - interval '1 day')::date END)
          WHEN cn.freq_group = 'annual' THEN make_date(extract(year from CURRENT_DATE)::int - 1, 12, 31)
          ELSE (date_trunc('month', CURRENT_DATE) - interval '1 day')::date END AS expected_period_end,
        CASE WHEN cn.freq_group = 'monthly' THEN (date_trunc('month', CURRENT_DATE) + interval '14 days')::date
          WHEN cn.freq_group IN ('quarterly','semiannual') THEN (date_trunc('month', (CASE WHEN cn.freq_group = 'quarterly' THEN (date_trunc('quarter', CURRENT_DATE) - interval '1 day')::date ELSE (CASE WHEN extract(month from CURRENT_DATE) <= 6 THEN (make_date(extract(year from CURRENT_DATE)::int, 1, 1) - interval '1 day')::date ELSE (make_date(extract(year from CURRENT_DATE)::int, 7, 1) - interval '1 day')::date END) END)) + interval '2 months - 1 day')::date
          WHEN cn.freq_group = 'annual' THEN (date_trunc('year', CURRENT_DATE) + interval '11 months - 1 day')::date
          ELSE (date_trunc('month', CURRENT_DATE) + interval '14 days')::date END AS due_date
      FROM controls_norm cn
    ),
    exec_for_expected AS (SELECT e.control_id, e.period_end::date AS period_end, e.workflow_status::text, e.auto_status::text FROM kpi_executions e WHERE e.tenant_id = ${tenantId}),
    status_eval AS (
      SELECT ex.control_id, ex.due_date, ef.workflow_status, ef.auto_status,
        CASE WHEN ef.workflow_status IS NULL OR ef.workflow_status IN ('draft','in_progress','needs_changes') THEN false ELSE true END AS is_executor_done
      FROM expected ex
      LEFT JOIN exec_for_expected ef ON ef.control_id = ex.control_id AND ef.period_end = ex.expected_period_end
    )
    SELECT
      (SELECT COUNT(*)::int FROM status_eval s WHERE s.is_executor_done = true AND s.auto_status = 'in_target') AS controls_ok,
      (SELECT COUNT(*)::int FROM status_eval s WHERE CURRENT_DATE > s.due_date AND s.is_executor_done = false) AS controls_overdue,
      (SELECT COUNT(*)::int FROM controls c JOIN risks r ON r.id = c.risk_id WHERE c.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND r.classification::text IN ('high','critical')) AS controls_critical,
      (SELECT COUNT(*)::int FROM kpi_executions e JOIN controls c ON c.id = e.control_id WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND e.auto_status::text = 'out_of_target') AS kpis_out_of_target
    FROM controls c WHERE c.tenant_id = ${tenantId} LIMIT 1
  `
    : oneTeam
      ? sql<{
          controls_ok: number
          controls_overdue: number
          controls_critical: number
          kpis_out_of_target: number
        }>`
    WITH controls_base AS (
      SELECT c.id AS control_id, c.tenant_id, c.risk_id, c.owner_user_id, c.control_code, c.name, c.framework_id, c.frequency::text AS frequency_text, c.frequency_key::text AS frequency_key_text
      FROM controls c WHERE c.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ${firstTeamId}::uuid)
    ),
    controls_norm AS (
      SELECT cb.*, CASE WHEN cb.frequency_key_text IN ('quarterly','semiannual','annual') THEN cb.frequency_key_text WHEN lower(cb.frequency_text) ~ '(tri|trimes|quarter|q[1-4])' THEN 'quarterly' WHEN lower(cb.frequency_text) ~ '(semes|semi|half)' THEN 'semiannual' WHEN lower(cb.frequency_text) ~ '(anual|annual|year)' THEN 'annual' WHEN lower(cb.frequency_text) ~ '(mens|month)' THEN 'monthly' WHEN lower(cb.frequency_text) ~ '(seman|week|wk)' THEN 'monthly' WHEN lower(cb.frequency_text) ~ '(diar|day|d\\b)' THEN 'monthly' ELSE 'monthly' END AS freq_group FROM controls_base cb
    ),
    expected AS (SELECT cn.control_id, cn.freq_group, CASE WHEN cn.freq_group = 'monthly' THEN (date_trunc('month', CURRENT_DATE) - interval '1 day')::date WHEN cn.freq_group = 'quarterly' THEN (date_trunc('quarter', CURRENT_DATE) - interval '1 day')::date WHEN cn.freq_group = 'semiannual' THEN (CASE WHEN extract(month from CURRENT_DATE) <= 6 THEN (make_date(extract(year from CURRENT_DATE)::int, 1, 1) - interval '1 day')::date ELSE (make_date(extract(year from CURRENT_DATE)::int, 7, 1) - interval '1 day')::date END) WHEN cn.freq_group = 'annual' THEN make_date(extract(year from CURRENT_DATE)::int - 1, 12, 31) ELSE (date_trunc('month', CURRENT_DATE) - interval '1 day')::date END AS expected_period_end, CASE WHEN cn.freq_group = 'monthly' THEN (date_trunc('month', CURRENT_DATE) + interval '14 days')::date WHEN cn.freq_group IN ('quarterly','semiannual') THEN (date_trunc('month', (CASE WHEN cn.freq_group = 'quarterly' THEN (date_trunc('quarter', CURRENT_DATE) - interval '1 day')::date ELSE (CASE WHEN extract(month from CURRENT_DATE) <= 6 THEN (make_date(extract(year from CURRENT_DATE)::int, 1, 1) - interval '1 day')::date ELSE (make_date(extract(year from CURRENT_DATE)::int, 7, 1) - interval '1 day')::date END) END)) + interval '2 months - 1 day')::date WHEN cn.freq_group = 'annual' THEN (date_trunc('year', CURRENT_DATE) + interval '11 months - 1 day')::date ELSE (date_trunc('month', CURRENT_DATE) + interval '14 days')::date END AS due_date FROM controls_norm cn),
    exec_for_expected AS (SELECT e.control_id, e.period_end::date AS period_end, e.workflow_status::text, e.auto_status::text FROM kpi_executions e WHERE e.tenant_id = ${tenantId}),
    status_eval AS (SELECT ex.control_id, ex.due_date, ef.workflow_status, ef.auto_status, CASE WHEN ef.workflow_status IS NULL OR ef.workflow_status IN ('draft','in_progress','needs_changes') THEN false ELSE true END AS is_executor_done FROM expected ex LEFT JOIN exec_for_expected ef ON ef.control_id = ex.control_id AND ef.period_end = ex.expected_period_end)
    SELECT (SELECT COUNT(*)::int FROM status_eval s WHERE s.is_executor_done = true AND s.auto_status = 'in_target') AS controls_ok, (SELECT COUNT(*)::int FROM status_eval s WHERE CURRENT_DATE > s.due_date AND s.is_executor_done = false) AS controls_overdue, (SELECT COUNT(*)::int FROM controls c JOIN risks r ON r.id = c.risk_id WHERE c.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ${firstTeamId}::uuid) AND r.classification::text IN ('high','critical')) AS controls_critical, (SELECT COUNT(*)::int FROM kpi_executions e JOIN controls c ON c.id = e.control_id WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ${firstTeamId}::uuid) AND e.auto_status::text = 'out_of_target') AS kpis_out_of_target FROM controls c WHERE c.tenant_id = ${tenantId} LIMIT 1
  `
      : sql<{
    controls_ok: number
    controls_overdue: number
    controls_critical: number
    kpis_out_of_target: number
  }>`
    WITH controls_base AS (
      SELECT c.id AS control_id, c.tenant_id, c.risk_id, c.owner_user_id, c.control_code, c.name, c.framework_id, c.frequency::text AS frequency_text, c.frequency_key::text AS frequency_key_text
      FROM controls c
      WHERE c.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ANY(${teamsArray}::uuid[]))
    ),

    controls_norm AS (
      SELECT
        cb.*,
        CASE
          WHEN cb.frequency_key_text IN ('quarterly','semiannual','annual') THEN cb.frequency_key_text
          WHEN lower(cb.frequency_text) ~ '(tri|trimes|quarter|q[1-4])' THEN 'quarterly'
          WHEN lower(cb.frequency_text) ~ '(semes|semi|half)' THEN 'semiannual'
          WHEN lower(cb.frequency_text) ~ '(anual|annual|year)' THEN 'annual'
          WHEN lower(cb.frequency_text) ~ '(mens|month)' THEN 'monthly'
          WHEN lower(cb.frequency_text) ~ '(seman|week|wk)' THEN 'monthly'
          WHEN lower(cb.frequency_text) ~ '(diar|day|d\\b)' THEN 'monthly'
          ELSE 'monthly'
        END AS freq_group
      FROM controls_base cb
    ),

    expected AS (
      SELECT
        cn.control_id,
        cn.freq_group,
        CASE
          WHEN cn.freq_group = 'monthly'
            THEN (date_trunc('month', CURRENT_DATE) - interval '1 day')::date
          WHEN cn.freq_group = 'quarterly'
            THEN (date_trunc('quarter', CURRENT_DATE) - interval '1 day')::date
          WHEN cn.freq_group = 'semiannual'
            THEN (
              CASE
                WHEN extract(month from CURRENT_DATE) <= 6
                  THEN (make_date(extract(year from CURRENT_DATE)::int, 1, 1) - interval '1 day')::date
                ELSE (make_date(extract(year from CURRENT_DATE)::int, 7, 1) - interval '1 day')::date
              END
            )
          WHEN cn.freq_group = 'annual'
            THEN make_date(extract(year from CURRENT_DATE)::int - 1, 12, 31)
          ELSE (date_trunc('month', CURRENT_DATE) - interval '1 day')::date
        END AS expected_period_end,

        CASE
          WHEN cn.freq_group = 'monthly'
            THEN (date_trunc('month', CURRENT_DATE) + interval '14 days')::date
          WHEN cn.freq_group IN ('quarterly','semiannual')
            THEN (
              date_trunc('month',
                CASE
                  WHEN cn.freq_group = 'quarterly'
                    THEN (date_trunc('quarter', CURRENT_DATE) - interval '1 day')::date
                  ELSE (
                    CASE
                      WHEN extract(month from CURRENT_DATE) <= 6
                        THEN (make_date(extract(year from CURRENT_DATE)::int, 1, 1) - interval '1 day')::date
                      ELSE (make_date(extract(year from CURRENT_DATE)::int, 7, 1) - interval '1 day')::date
                    END
                  )
                END
              ) + interval '2 months - 1 day'
            )::date
          WHEN cn.freq_group = 'annual'
            THEN (date_trunc('year', CURRENT_DATE) + interval '11 months - 1 day')::date
          ELSE (date_trunc('month', CURRENT_DATE) + interval '14 days')::date
        END AS due_date
      FROM controls_norm cn
    ),

    exec_for_expected AS (
      SELECT
        e.control_id,
        e.period_end::date AS period_end,
        e.workflow_status::text AS workflow_status,
        e.auto_status::text AS auto_status
      FROM kpi_executions e
      WHERE e.tenant_id = ${tenantId}
    ),

    status_eval AS (
      SELECT
        ex.control_id,
        ex.due_date,
        ef.workflow_status,
        ef.auto_status,
        CASE
          WHEN ef.workflow_status IS NULL THEN false
          WHEN ef.workflow_status IN ('draft','in_progress','needs_changes') THEN false
          ELSE true
        END AS is_executor_done
      FROM expected ex
      LEFT JOIN exec_for_expected ef
        ON ef.control_id = ex.control_id
       AND ef.period_end = ex.expected_period_end
    )

    SELECT
      (SELECT COUNT(*)::int
       FROM status_eval s
       WHERE s.is_executor_done = true
         AND s.auto_status = 'in_target'
      ) AS controls_ok,

      (SELECT COUNT(*)::int
       FROM status_eval s
       WHERE CURRENT_DATE > s.due_date
         AND s.is_executor_done = false
      ) AS controls_overdue,

      (SELECT COUNT(*)::int
       FROM controls c
       JOIN risks r ON r.id = c.risk_id
       WHERE c.tenant_id = ${tenantId}
         AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid)
         AND (c.team_id IS NULL OR c.team_id = ANY(${teamsArray}::uuid[]))
         AND r.classification::text IN ('high','critical')
      ) AS controls_critical,

      (SELECT COUNT(*)::int
       FROM kpi_executions e
       JOIN controls c ON c.id = e.control_id
       WHERE e.tenant_id = ${tenantId}
         AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid)
         AND (c.team_id IS NULL OR c.team_id = ANY(${teamsArray}::uuid[]))
         AND e.auto_status::text = 'out_of_target'
      ) AS kpis_out_of_target
  `
  // =========================
  // Counts (período + framework)
  // =========================
  const countsPromise =
    noScope
      ? sql<{ executions_total: number; executions_pending_grc: number; action_plans_open: number; action_plans_overdue: number }>`
    SELECT
      (SELECT COUNT(*)::int FROM kpi_executions e JOIN controls c ON c.id = e.control_id
        WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid)
          AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date) AS executions_total,
      (SELECT COUNT(*)::int FROM kpi_executions e JOIN controls c ON c.id = e.control_id
        WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid)
          AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date
          AND e.workflow_status IN ('submitted','under_review','needs_changes')) AS executions_pending_grc,
      (SELECT COUNT(*)::int FROM action_plans ap WHERE ap.tenant_id = ${tenantId} AND ap.status::text <> 'done') AS action_plans_open,
      (SELECT COUNT(*)::int FROM action_plans ap WHERE ap.tenant_id = ${tenantId} AND ap.status::text <> 'done' AND ap.due_date IS NOT NULL AND ap.due_date < CURRENT_DATE) AS action_plans_overdue
    FROM (SELECT 1) t
  `
      : oneTeam
        ? sql<{ executions_total: number; executions_pending_grc: number; action_plans_open: number; action_plans_overdue: number }>`
    SELECT
      (SELECT COUNT(*)::int FROM kpi_executions e JOIN controls c ON c.id = e.control_id
        WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ${firstTeamId}::uuid)
          AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date) AS executions_total,
      (SELECT COUNT(*)::int FROM kpi_executions e JOIN controls c ON c.id = e.control_id
        WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ${firstTeamId}::uuid)
          AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date AND e.workflow_status IN ('submitted','under_review','needs_changes')) AS executions_pending_grc,
      (SELECT COUNT(*)::int FROM action_plans ap WHERE ap.tenant_id = ${tenantId} AND (ap.team_id IS NULL OR ap.team_id = ${firstTeamId}::uuid) AND ap.status::text <> 'done') AS action_plans_open,
      (SELECT COUNT(*)::int FROM action_plans ap WHERE ap.tenant_id = ${tenantId} AND (ap.team_id IS NULL OR ap.team_id = ${firstTeamId}::uuid) AND ap.status::text <> 'done' AND ap.due_date IS NOT NULL AND ap.due_date < CURRENT_DATE) AS action_plans_overdue
    FROM (SELECT 1) t
  `
        : sql<{ executions_total: number; executions_pending_grc: number; action_plans_open: number; action_plans_overdue: number }>`
    SELECT
      (SELECT COUNT(*)::int FROM kpi_executions e JOIN controls c ON c.id = e.control_id
        WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ANY(${teamsArray}::uuid[]))
          AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date) AS executions_total,
      (SELECT COUNT(*)::int FROM kpi_executions e JOIN controls c ON c.id = e.control_id
        WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ANY(${teamsArray}::uuid[]))
          AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date AND e.workflow_status IN ('submitted','under_review','needs_changes')) AS executions_pending_grc,
      (SELECT COUNT(*)::int FROM action_plans ap WHERE ap.tenant_id = ${tenantId} AND (ap.team_id IS NULL OR ap.team_id = ANY(${teamsArray}::uuid[])) AND ap.status::text <> 'done') AS action_plans_open,
      (SELECT COUNT(*)::int FROM action_plans ap WHERE ap.tenant_id = ${tenantId} AND (ap.team_id IS NULL OR ap.team_id = ANY(${teamsArray}::uuid[])) AND ap.status::text <> 'done' AND ap.due_date IS NOT NULL AND ap.due_date < CURRENT_DATE) AS action_plans_overdue
    FROM (SELECT 1) t
  `
  // =========================
  // Execuções por workflow_status (período + framework)
  // =========================
  const wfPromise = noScope
    ? sql<{ workflow_status: string; count: number }>`SELECT e.workflow_status::text AS workflow_status, COUNT(*)::int AS count FROM kpi_executions e JOIN controls c ON c.id = e.control_id WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date GROUP BY e.workflow_status ORDER BY count DESC, workflow_status ASC`
    : oneTeam
      ? sql<{ workflow_status: string; count: number }>`SELECT e.workflow_status::text AS workflow_status, COUNT(*)::int AS count FROM kpi_executions e JOIN controls c ON c.id = e.control_id WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ${firstTeamId}::uuid) AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date GROUP BY e.workflow_status ORDER BY count DESC, workflow_status ASC`
      : sql<{ workflow_status: string; count: number }>`SELECT e.workflow_status::text AS workflow_status, COUNT(*)::int AS count FROM kpi_executions e JOIN controls c ON c.id = e.control_id WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ANY(${teamsArray}::uuid[])) AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date GROUP BY e.workflow_status ORDER BY count DESC, workflow_status ASC`

  // =========================
  // Execuções por auto_status (período + framework)
  // =========================
  const autoPromise =
    noScope
      ? sql<{ auto_status: string; count: number }>`SELECT e.auto_status::text AS auto_status, COUNT(*)::int AS count FROM kpi_executions e JOIN controls c ON c.id = e.control_id WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date GROUP BY e.auto_status ORDER BY count DESC, auto_status ASC`
      : oneTeam
        ? sql<{ auto_status: string; count: number }>`SELECT e.auto_status::text AS auto_status, COUNT(*)::int AS count FROM kpi_executions e JOIN controls c ON c.id = e.control_id WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ${firstTeamId}::uuid) AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date GROUP BY e.auto_status ORDER BY count DESC, auto_status ASC`
        : sql<{ auto_status: string; count: number }>`SELECT e.auto_status::text AS auto_status, COUNT(*)::int AS count FROM kpi_executions e JOIN controls c ON c.id = e.control_id WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ANY(${teamsArray}::uuid[])) AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date GROUP BY e.auto_status ORDER BY count DESC, auto_status ASC`

  // =========================
  // Action plans por prioridade
  // =========================
  const prioPromise =
    noScope
      ? sql<{ priority: string; count: number }>`SELECT priority::text AS priority, COUNT(*)::int AS count FROM action_plans ap WHERE ap.tenant_id = ${tenantId} AND ap.status::text <> 'done' GROUP BY ap.priority ORDER BY count DESC, priority ASC`
      : oneTeam
        ? sql<{ priority: string; count: number }>`SELECT priority::text AS priority, COUNT(*)::int AS count FROM action_plans ap WHERE ap.tenant_id = ${tenantId} AND (ap.team_id IS NULL OR ap.team_id = ${firstTeamId}::uuid) AND ap.status::text <> 'done' GROUP BY ap.priority ORDER BY count DESC, priority ASC`
        : sql<{ priority: string; count: number }>`SELECT priority::text AS priority, COUNT(*)::int AS count FROM action_plans ap WHERE ap.tenant_id = ${tenantId} AND (ap.team_id IS NULL OR ap.team_id = ANY(${teamsArray}::uuid[])) AND ap.status::text <> 'done' GROUP BY ap.priority ORDER BY count DESC, priority ASC`

  // =========================
  // Action plans vencendo em até 7 dias
  // =========================
  const dueSoonPromise =
    noScope
      ? sql<{ id: string; title: string; priority: string; status: string; due_date: string; execution_id: string; control_code: string | null; kpi_code: string | null }>`SELECT ap.id, ap.title, ap.priority::text AS priority, ap.status::text AS status, ap.due_date::text AS due_date, ap.execution_id::text AS execution_id, c.control_code::text AS control_code, k.kpi_code::text AS kpi_code FROM action_plans ap LEFT JOIN controls c ON c.id = ap.control_id LEFT JOIN kpis k ON k.id = ap.kpi_id WHERE ap.tenant_id = ${tenantId} AND ap.status::text <> 'done' AND ap.due_date IS NOT NULL AND ap.due_date <= (CURRENT_DATE + INTERVAL '7 days')::date ORDER BY ap.due_date ASC, ap.priority DESC, ap.created_at DESC LIMIT 10`
      : oneTeam
        ? sql<{ id: string; title: string; priority: string; status: string; due_date: string; execution_id: string; control_code: string | null; kpi_code: string | null }>`SELECT ap.id, ap.title, ap.priority::text AS priority, ap.status::text AS status, ap.due_date::text AS due_date, ap.execution_id::text AS execution_id, c.control_code::text AS control_code, k.kpi_code::text AS kpi_code FROM action_plans ap LEFT JOIN controls c ON c.id = ap.control_id LEFT JOIN kpis k ON k.id = ap.kpi_id WHERE ap.tenant_id = ${tenantId} AND (ap.team_id IS NULL OR ap.team_id = ${firstTeamId}::uuid) AND ap.status::text <> 'done' AND ap.due_date IS NOT NULL AND ap.due_date <= (CURRENT_DATE + INTERVAL '7 days')::date ORDER BY ap.due_date ASC, ap.priority DESC, ap.created_at DESC LIMIT 10`
        : sql<{ id: string; title: string; priority: string; status: string; due_date: string; execution_id: string; control_code: string | null; kpi_code: string | null }>`SELECT ap.id, ap.title, ap.priority::text AS priority, ap.status::text AS status, ap.due_date::text AS due_date, ap.execution_id::text AS execution_id, c.control_code::text AS control_code, k.kpi_code::text AS kpi_code FROM action_plans ap LEFT JOIN controls c ON c.id = ap.control_id LEFT JOIN kpis k ON k.id = ap.kpi_id WHERE ap.tenant_id = ${tenantId} AND (ap.team_id IS NULL OR ap.team_id = ANY(${teamsArray}::uuid[])) AND ap.status::text <> 'done' AND ap.due_date IS NOT NULL AND ap.due_date <= (CURRENT_DATE + INTERVAL '7 days')::date ORDER BY ap.due_date ASC, ap.priority DESC, ap.created_at DESC LIMIT 10`

  // =========================
  // Execuções recentes (período + framework)
  // =========================
  const recentExecPromise =
    noScope
      ? sql<{ id: string; control_code: string; kpi_code: string; period_start: string; period_end: string; auto_status: string; workflow_status: string; created_at: string }>`SELECT e.id::text AS id, c.control_code::text AS control_code, k.kpi_code::text AS kpi_code, e.period_start::text AS period_start, e.period_end::text AS period_end, e.auto_status::text AS auto_status, e.workflow_status::text AS workflow_status, e.created_at::text AS created_at FROM kpi_executions e JOIN controls c ON c.id = e.control_id JOIN kpis k ON k.id = e.kpi_id WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date ORDER BY e.created_at DESC LIMIT 10`
      : oneTeam
        ? sql<{ id: string; control_code: string; kpi_code: string; period_start: string; period_end: string; auto_status: string; workflow_status: string; created_at: string }>`SELECT e.id::text AS id, c.control_code::text AS control_code, k.kpi_code::text AS kpi_code, e.period_start::text AS period_start, e.period_end::text AS period_end, e.auto_status::text AS auto_status, e.workflow_status::text AS workflow_status, e.created_at::text AS created_at FROM kpi_executions e JOIN controls c ON c.id = e.control_id JOIN kpis k ON k.id = e.kpi_id WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ${firstTeamId}::uuid) AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date ORDER BY e.created_at DESC LIMIT 10`
        : sql<{ id: string; control_code: string; kpi_code: string; period_start: string; period_end: string; auto_status: string; workflow_status: string; created_at: string }>`SELECT e.id::text AS id, c.control_code::text AS control_code, k.kpi_code::text AS kpi_code, e.period_start::text AS period_start, e.period_end::text AS period_end, e.auto_status::text AS auto_status, e.workflow_status::text AS workflow_status, e.created_at::text AS created_at FROM kpi_executions e JOIN controls c ON c.id = e.control_id JOIN kpis k ON k.id = e.kpi_id WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ANY(${teamsArray}::uuid[])) AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date ORDER BY e.created_at DESC LIMIT 10`

  // =========================
  // Gráfico 6 meses (% in_target) + framework
  // =========================
  const perfPromise =
    noScope
      ? sql<{ month: string; pct_in_target: number }>`WITH months AS (SELECT generate_series(date_trunc('month', CURRENT_DATE) - interval '5 months', date_trunc('month', CURRENT_DATE), interval '1 month')::date AS month_start), agg AS (SELECT date_trunc('month', e.period_start)::date AS month_start, COUNT(*)::int AS total, SUM(CASE WHEN e.auto_status::text = 'in_target' THEN 1 ELSE 0 END)::int AS ok FROM kpi_executions e JOIN controls c ON c.id = e.control_id WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND e.period_start >= (date_trunc('month', CURRENT_DATE) - interval '5 months')::date GROUP BY 1) SELECT to_char(m.month_start, 'Mon')::text AS month, COALESCE(ROUND((a.ok::numeric / NULLIF(a.total,0)) * 100, 0), 0)::int AS pct_in_target FROM months m LEFT JOIN agg a ON a.month_start = m.month_start ORDER BY m.month_start ASC`
      : oneTeam
        ? sql<{ month: string; pct_in_target: number }>`WITH months AS (SELECT generate_series(date_trunc('month', CURRENT_DATE) - interval '5 months', date_trunc('month', CURRENT_DATE), interval '1 month')::date AS month_start), agg AS (SELECT date_trunc('month', e.period_start)::date AS month_start, COUNT(*)::int AS total, SUM(CASE WHEN e.auto_status::text = 'in_target' THEN 1 ELSE 0 END)::int AS ok FROM kpi_executions e JOIN controls c ON c.id = e.control_id WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ${firstTeamId}::uuid) AND e.period_start >= (date_trunc('month', CURRENT_DATE) - interval '5 months')::date GROUP BY 1) SELECT to_char(m.month_start, 'Mon')::text AS month, COALESCE(ROUND((a.ok::numeric / NULLIF(a.total,0)) * 100, 0), 0)::int AS pct_in_target FROM months m LEFT JOIN agg a ON a.month_start = m.month_start ORDER BY m.month_start ASC`
        : sql<{ month: string; pct_in_target: number }>`WITH months AS (SELECT generate_series(date_trunc('month', CURRENT_DATE) - interval '5 months', date_trunc('month', CURRENT_DATE), interval '1 month')::date AS month_start), agg AS (SELECT date_trunc('month', e.period_start)::date AS month_start, COUNT(*)::int AS total, SUM(CASE WHEN e.auto_status::text = 'in_target' THEN 1 ELSE 0 END)::int AS ok FROM kpi_executions e JOIN controls c ON c.id = e.control_id WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ANY(${teamsArray}::uuid[])) AND e.period_start >= (date_trunc('month', CURRENT_DATE) - interval '5 months')::date GROUP BY 1) SELECT to_char(m.month_start, 'Mon')::text AS month, COALESCE(ROUND((a.ok::numeric / NULLIF(a.total,0)) * 100, 0), 0)::int AS pct_in_target FROM months m LEFT JOIN agg a ON a.month_start = m.month_start ORDER BY m.month_start ASC`

  // =========================
  // Controles críticos + framework
  // =========================
  const criticalPromise =
    noScope
      ? sql<{ control_id: string; control_code: string; control_name: string; owner_name: string | null; workflow_status: string | null; due_date: string | null }>`
    WITH latest_exec AS (SELECT DISTINCT ON (e.control_id) e.control_id, e.workflow_status::text AS workflow_status, e.due_date::text AS due_date FROM kpi_executions e WHERE e.tenant_id = ${tenantId} ORDER BY e.control_id, e.period_end DESC NULLS LAST, e.created_at DESC)
    SELECT c.id::text AS control_id, c.control_code::text AS control_code, c.name::text AS control_name, u.name::text AS owner_name, le.workflow_status::text AS workflow_status, le.due_date::text AS due_date
    FROM controls c JOIN risks r ON r.id = c.risk_id LEFT JOIN users u ON u.id = c.owner_user_id LEFT JOIN latest_exec le ON le.control_id = c.id
    WHERE c.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND r.classification::text IN ('high','critical')
    ORDER BY c.updated_at DESC LIMIT 10
  `
      : oneTeam
        ? sql<{ control_id: string; control_code: string; control_name: string; owner_name: string | null; workflow_status: string | null; due_date: string | null }>`
    WITH latest_exec AS (SELECT DISTINCT ON (e.control_id) e.control_id, e.workflow_status::text AS workflow_status, e.due_date::text AS due_date FROM kpi_executions e WHERE e.tenant_id = ${tenantId} ORDER BY e.control_id, e.period_end DESC NULLS LAST, e.created_at DESC)
    SELECT c.id::text AS control_id, c.control_code::text AS control_code, c.name::text AS control_name, u.name::text AS owner_name, le.workflow_status::text AS workflow_status, le.due_date::text AS due_date
    FROM controls c JOIN risks r ON r.id = c.risk_id LEFT JOIN users u ON u.id = c.owner_user_id LEFT JOIN latest_exec le ON le.control_id = c.id
    WHERE c.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ${firstTeamId}::uuid) AND r.classification::text IN ('high','critical')
    ORDER BY c.updated_at DESC LIMIT 10
  `
        : sql<{ control_id: string; control_code: string; control_name: string; owner_name: string | null; workflow_status: string | null; due_date: string | null }>`
    WITH latest_exec AS (SELECT DISTINCT ON (e.control_id) e.control_id, e.workflow_status::text AS workflow_status, e.due_date::text AS due_date FROM kpi_executions e WHERE e.tenant_id = ${tenantId} ORDER BY e.control_id, e.period_end DESC NULLS LAST, e.created_at DESC)
    SELECT c.id::text AS control_id, c.control_code::text AS control_code, c.name::text AS control_name, u.name::text AS owner_name, le.workflow_status::text AS workflow_status, le.due_date::text AS due_date
    FROM controls c JOIN risks r ON r.id = c.risk_id LEFT JOIN users u ON u.id = c.owner_user_id LEFT JOIN latest_exec le ON le.control_id = c.id
    WHERE c.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ANY(${teamsArray}::uuid[])) AND r.classification::text IN ('high','critical')
    ORDER BY c.updated_at DESC LIMIT 10
  `

  const [
    frameworksRes,
    cardsRes,
    countsRes,
    wfRes,
    autoRes,
    prioRes,
    dueSoonRes,
    recentExecRes,
    perfRes,
    criticalRes,
  ] = await Promise.all([
    frameworksPromise,
    cardsPromise,
    countsPromise,
    wfPromise,
    autoPromise,
    prioPromise,
    dueSoonPromise,
    recentExecPromise,
    perfPromise,
    criticalPromise,
  ])

  const filters: DashboardFilters = { frameworks: frameworksRes.rows }
  const cards = cardsRes.rows[0] ?? {
    controls_ok: 0,
    controls_overdue: 0,
    controls_critical: 0,
    kpis_out_of_target: 0,
  }
  const counts = countsRes.rows[0] ?? {
    executions_total: 0,
    executions_pending_grc: 0,
    action_plans_open: 0,
    action_plans_overdue: 0,
  }

  const today0 = new Date()
  today0.setHours(0, 0, 0, 0)

  const critical_controls = criticalRes.rows.map((row) => {
    const wf = (row.workflow_status || "").toLowerCase()
    const due = row.due_date ? new Date(row.due_date) : null
    const overdue = due ? due.getTime() < today0.getTime() : false

    let status_label = "—"
    let status_kind: "danger" | "warning" | "info" | "neutral" = "neutral"

    if (overdue && (wf === "draft" || wf === "in_progress" || wf === "needs_changes")) {
      status_label = "Vencido"
      status_kind = "danger"
    } else if (wf === "under_review") {
      status_label = "Em Revisão"
      status_kind = "warning"
    } else if (wf === "submitted") {
      status_label = "Aguardando Evidência"
      status_kind = "info"
    } else if (wf === "approved") {
      status_label = "OK"
      status_kind = "neutral"
    } else if (wf) {
      status_label = row.workflow_status as string
      status_kind = "neutral"
    }

    return {
      control_id: row.control_id,
      control_code: row.control_code,
      control_name: row.control_name,
      owner_name: row.owner_name,
      status_label,
      status_kind,
    }
  })

  return {
    filters,
    cards,
    counts,
    executions_by_workflow: wfRes.rows,
    executions_by_auto: autoRes.rows,
    action_plans_by_priority: prioRes.rows,
    action_plans_due_soon: dueSoonRes.rows,
    recent_executions: recentExecRes.rows,
    performance_6m: perfRes.rows,
    critical_controls,
  }
}

