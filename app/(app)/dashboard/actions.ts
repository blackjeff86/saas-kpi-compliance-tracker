// app/(app)/dashboard/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"
import { getDashboardScope } from "../lib/authz"
import { ensureTeamIdColumns } from "../lib/rbac-migrations"
import { fetchControlsPage } from "../controles/actions"
import type { ActionPlanListRow } from "../action-plans/actions-list"

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
    controls_pending_execution: number
    controls_overdue_execution: number
    controls_not_applicable: number
  }

  executions_by_workflow: Array<{ workflow_status: string; count: number }>
  executions_by_auto: Array<{ auto_status: string; count: number }>
  action_plans_by_priority: Array<{ priority: string; count: number }>

  action_plans_due_soon: ActionPlanListRow[]

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
  performance_status_6m: Array<{
    month_key: string
    effective: number
    warning: number
    critical: number
    pending: number
    overdue: number
    not_applicable: number
    total: number
  }>
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

function toMonthRef(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

async function ensureActionPlanTasksTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS action_plan_tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      action_plan_id uuid NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
      title text NOT NULL,
      due_date date NULL,
      priority text NULL,
      responsible_name text NULL,
      is_done boolean NOT NULL DEFAULT false,
      done_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `
}

let ensureActionPlanTasksTablePromise: Promise<void> | null = null
async function ensureActionPlanTasksTableOnce() {
  if (!ensureActionPlanTasksTablePromise) {
    ensureActionPlanTasksTablePromise = ensureActionPlanTasksTable()
  }
  await ensureActionPlanTasksTablePromise
}

export async function fetchDashboardSummary(q: DashboardQuery = {}): Promise<DashboardSummary> {
  const ctx = await getContext()
  const tenantId = ctx.tenantId

  await ensureActionPlanTasksTableOnce()
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
      (SELECT COUNT(*)::int
       FROM kpi_executions e
       JOIN controls c ON c.id = e.control_id
       LEFT JOIN LATERAL (
         SELECT gr.decision::text AS decision
         FROM grc_reviews gr
         WHERE gr.tenant_id = e.tenant_id
           AND gr.execution_id = e.id
         ORDER BY gr.created_at DESC
         LIMIT 1
       ) gr ON true
       WHERE e.tenant_id = ${tenantId}
         AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid)
         AND e.period_start >= ${startDate}::date
         AND e.period_start < ${endDate}::date
         AND (
           CASE lower(trim(COALESCE(gr.decision, e.grc_review_status::text, e.workflow_status::text, 'pending')))
             WHEN 'in_review' THEN 'under_review'
             ELSE lower(trim(COALESCE(gr.decision, e.grc_review_status::text, e.workflow_status::text, 'pending')))
           END
         ) IN ('pending', 'submitted', 'under_review')
      ) AS executions_pending_grc,
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
      (SELECT COUNT(*)::int
       FROM kpi_executions e
       JOIN controls c ON c.id = e.control_id
       LEFT JOIN LATERAL (
         SELECT gr.decision::text AS decision
         FROM grc_reviews gr
         WHERE gr.tenant_id = e.tenant_id
           AND gr.execution_id = e.id
         ORDER BY gr.created_at DESC
         LIMIT 1
       ) gr ON true
       WHERE e.tenant_id = ${tenantId}
         AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid)
         AND (c.team_id IS NULL OR c.team_id = ${firstTeamId}::uuid)
         AND e.period_start >= ${startDate}::date
         AND e.period_start < ${endDate}::date
         AND (
           CASE lower(trim(COALESCE(gr.decision, e.grc_review_status::text, e.workflow_status::text, 'pending')))
             WHEN 'in_review' THEN 'under_review'
             ELSE lower(trim(COALESCE(gr.decision, e.grc_review_status::text, e.workflow_status::text, 'pending')))
           END
         ) IN ('pending', 'submitted', 'under_review')
      ) AS executions_pending_grc,
      (SELECT COUNT(*)::int FROM action_plans ap WHERE ap.tenant_id = ${tenantId} AND (ap.team_id IS NULL OR ap.team_id = ${firstTeamId}::uuid) AND ap.status::text <> 'done') AS action_plans_open,
      (SELECT COUNT(*)::int FROM action_plans ap WHERE ap.tenant_id = ${tenantId} AND (ap.team_id IS NULL OR ap.team_id = ${firstTeamId}::uuid) AND ap.status::text <> 'done' AND ap.due_date IS NOT NULL AND ap.due_date < CURRENT_DATE) AS action_plans_overdue
    FROM (SELECT 1) t
  `
        : sql<{ executions_total: number; executions_pending_grc: number; action_plans_open: number; action_plans_overdue: number }>`
    SELECT
      (SELECT COUNT(*)::int FROM kpi_executions e JOIN controls c ON c.id = e.control_id
        WHERE e.tenant_id = ${tenantId} AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid) AND (c.team_id IS NULL OR c.team_id = ANY(${teamsArray}::uuid[]))
          AND e.period_start >= ${startDate}::date AND e.period_start < ${endDate}::date) AS executions_total,
      (SELECT COUNT(*)::int
       FROM kpi_executions e
       JOIN controls c ON c.id = e.control_id
       LEFT JOIN LATERAL (
         SELECT gr.decision::text AS decision
         FROM grc_reviews gr
         WHERE gr.tenant_id = e.tenant_id
           AND gr.execution_id = e.id
         ORDER BY gr.created_at DESC
         LIMIT 1
       ) gr ON true
       WHERE e.tenant_id = ${tenantId}
         AND (${frameworkId}::uuid IS NULL OR c.framework_id = ${frameworkId}::uuid)
         AND (c.team_id IS NULL OR c.team_id = ANY(${teamsArray}::uuid[]))
         AND e.period_start >= ${startDate}::date
         AND e.period_start < ${endDate}::date
         AND (
           CASE lower(trim(COALESCE(gr.decision, e.grc_review_status::text, e.workflow_status::text, 'pending')))
             WHEN 'in_review' THEN 'under_review'
             ELSE lower(trim(COALESCE(gr.decision, e.grc_review_status::text, e.workflow_status::text, 'pending')))
           END
         ) IN ('pending', 'submitted', 'under_review')
      ) AS executions_pending_grc,
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
      ? sql<ActionPlanListRow>`
    SELECT
      ap.id::text AS id,
      ap.title::text AS title,
      ap.description::text AS description,
      ap.responsible_name::text AS responsible_name,
      CASE
        WHEN COALESCE(tc.task_total, 0) > 0
          THEN ROUND((COALESCE(tc.task_done, 0)::numeric * 100.0) / COALESCE(tc.task_total, 0))::int
        WHEN ap.status::text = 'done' THEN 100
        ELSE 0
      END::int AS progress_percent,
      ap.priority::text AS priority,
      ap.status::text AS status,
      ap.due_date::text AS due_date,
      ap.execution_id::text AS execution_id,
      c.control_code::text AS control_code,
      k.kpi_code::text AS kpi_code,
      e.auto_status::text AS auto_status,
      e.workflow_status::text AS workflow_status,
      ap.risk_id::text AS risk_id,
      r.title::text AS risk_title,
      r.classification::text AS risk_classification
    FROM action_plans ap
    LEFT JOIN kpi_executions e ON e.id = ap.execution_id AND e.tenant_id = ap.tenant_id
    LEFT JOIN controls c ON c.id = ap.control_id AND c.tenant_id = ap.tenant_id
    LEFT JOIN kpis k ON k.id = ap.kpi_id AND k.tenant_id = ap.tenant_id
    LEFT JOIN risk_catalog r ON r.id = ap.risk_id AND r.tenant_id = ap.tenant_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS task_total, SUM(CASE WHEN t.is_done THEN 1 ELSE 0 END)::int AS task_done
      FROM action_plan_tasks t
      WHERE t.tenant_id = ap.tenant_id AND t.action_plan_id = ap.id
    ) tc ON true
    WHERE ap.tenant_id = ${tenantId}
      AND ap.status::text <> 'done'
      AND ap.due_date IS NOT NULL
      AND ap.due_date <= (CURRENT_DATE + INTERVAL '7 days')::date
    ORDER BY ap.due_date ASC, ap.priority DESC, ap.created_at DESC
    LIMIT 10
  `
      : oneTeam
        ? sql<ActionPlanListRow>`
    SELECT
      ap.id::text AS id,
      ap.title::text AS title,
      ap.description::text AS description,
      ap.responsible_name::text AS responsible_name,
      CASE
        WHEN COALESCE(tc.task_total, 0) > 0
          THEN ROUND((COALESCE(tc.task_done, 0)::numeric * 100.0) / COALESCE(tc.task_total, 0))::int
        WHEN ap.status::text = 'done' THEN 100
        ELSE 0
      END::int AS progress_percent,
      ap.priority::text AS priority,
      ap.status::text AS status,
      ap.due_date::text AS due_date,
      ap.execution_id::text AS execution_id,
      c.control_code::text AS control_code,
      k.kpi_code::text AS kpi_code,
      e.auto_status::text AS auto_status,
      e.workflow_status::text AS workflow_status,
      ap.risk_id::text AS risk_id,
      r.title::text AS risk_title,
      r.classification::text AS risk_classification
    FROM action_plans ap
    LEFT JOIN kpi_executions e ON e.id = ap.execution_id AND e.tenant_id = ap.tenant_id
    LEFT JOIN controls c ON c.id = ap.control_id AND c.tenant_id = ap.tenant_id
    LEFT JOIN kpis k ON k.id = ap.kpi_id AND k.tenant_id = ap.tenant_id
    LEFT JOIN risk_catalog r ON r.id = ap.risk_id AND r.tenant_id = ap.tenant_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS task_total, SUM(CASE WHEN t.is_done THEN 1 ELSE 0 END)::int AS task_done
      FROM action_plan_tasks t
      WHERE t.tenant_id = ap.tenant_id AND t.action_plan_id = ap.id
    ) tc ON true
    WHERE ap.tenant_id = ${tenantId}
      AND (ap.team_id IS NULL OR ap.team_id = ${firstTeamId}::uuid)
      AND ap.status::text <> 'done'
      AND ap.due_date IS NOT NULL
      AND ap.due_date <= (CURRENT_DATE + INTERVAL '7 days')::date
    ORDER BY ap.due_date ASC, ap.priority DESC, ap.created_at DESC
    LIMIT 10
  `
        : sql<ActionPlanListRow>`
    SELECT
      ap.id::text AS id,
      ap.title::text AS title,
      ap.description::text AS description,
      ap.responsible_name::text AS responsible_name,
      CASE
        WHEN COALESCE(tc.task_total, 0) > 0
          THEN ROUND((COALESCE(tc.task_done, 0)::numeric * 100.0) / COALESCE(tc.task_total, 0))::int
        WHEN ap.status::text = 'done' THEN 100
        ELSE 0
      END::int AS progress_percent,
      ap.priority::text AS priority,
      ap.status::text AS status,
      ap.due_date::text AS due_date,
      ap.execution_id::text AS execution_id,
      c.control_code::text AS control_code,
      k.kpi_code::text AS kpi_code,
      e.auto_status::text AS auto_status,
      e.workflow_status::text AS workflow_status,
      ap.risk_id::text AS risk_id,
      r.title::text AS risk_title,
      r.classification::text AS risk_classification
    FROM action_plans ap
    LEFT JOIN kpi_executions e ON e.id = ap.execution_id AND e.tenant_id = ap.tenant_id
    LEFT JOIN controls c ON c.id = ap.control_id AND c.tenant_id = ap.tenant_id
    LEFT JOIN kpis k ON k.id = ap.kpi_id AND k.tenant_id = ap.tenant_id
    LEFT JOIN risk_catalog r ON r.id = ap.risk_id AND r.tenant_id = ap.tenant_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS task_total, SUM(CASE WHEN t.is_done THEN 1 ELSE 0 END)::int AS task_done
      FROM action_plan_tasks t
      WHERE t.tenant_id = ap.tenant_id AND t.action_plan_id = ap.id
    ) tc ON true
    WHERE ap.tenant_id = ${tenantId}
      AND (ap.team_id IS NULL OR ap.team_id = ANY(${teamsArray}::uuid[]))
      AND ap.status::text <> 'done'
      AND ap.due_date IS NOT NULL
      AND ap.due_date <= (CURRENT_DATE + INTERVAL '7 days')::date
    ORDER BY ap.due_date ASC, ap.priority DESC, ap.created_at DESC
    LIMIT 10
  `

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
  // Gráfico 6 meses (status de controles por mês)
  // Sempre usa últimos 6 meses a partir de hoje, independente do filtro de mês/ano
  // Fonte: dados reais inseridos no banco (via fetchControlsPage)
  // =========================
  const perfStatusPromise = (async () => {
    let frameworkName = ""
    if (frameworkId) {
      const fwRes = await sql<{ name: string }>`
        SELECT name::text AS name
        FROM frameworks
        WHERE tenant_id = ${tenantId}
          AND id = ${frameworkId}::uuid
        LIMIT 1
      `
      frameworkName = fwRes.rows[0]?.name ?? ""
    }

    const now = new Date()
    const monthRefs: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1))
      monthRefs.push(toMonthRef(d))
    }

    const rows = await Promise.all(
      monthRefs.map(async (mes_ref) => {
        const page = await fetchControlsPage({
          mes_ref,
          framework: frameworkName,
          limit: 0,
        })

        let effective = 0
        let warning = 0
        let critical = 0
        let pending = 0
        let overdue = 0
        let not_applicable = 0

        for (const row of page.rows) {
          const s = String(row.control_result ?? row.control_result_suggested ?? "pending").toLowerCase()
          if (s === "effective") effective++
          else if (s === "warning") warning++
          else if (s === "critical") critical++
          else if (s === "overdue") overdue++
          else if (s === "not_applicable") not_applicable++
          else pending++
        }

        return {
          month_key: mes_ref,
          effective,
          warning,
          critical,
          pending,
          overdue,
          not_applicable,
          total: page.rows.length,
        }
      })
    )

    return { rows }
  })()

  // =========================
  // Controles críticos: resultado mês = Critical (via fetchControlsPage, mesmo critério da tabela Controles)
  // =========================
  const criticalPromise = (async () => {
    let frameworkName = ""
    if (frameworkId) {
      const fwRes = await sql<{ name: string }>`
        SELECT name::text AS name FROM frameworks
        WHERE tenant_id = ${tenantId} AND id = ${frameworkId}::uuid LIMIT 1
      `
      frameworkName = fwRes.rows[0]?.name ?? ""
    }
    const mesRef = `${year}-${String(month).padStart(2, "0")}`
    const page = await fetchControlsPage({
      mes_ref: mesRef,
      framework: frameworkName,
      resultado: "critical",
      limit: 10,
      offset: 0,
    })
    return page.rows.map((r) => ({
      control_id: r.id,
      control_code: r.control_code,
      control_name: r.name,
      owner_name: r.control_owner_name,
      status_label: "Critical",
      status_kind: "danger" as const,
    }))
  })()

  // =========================
  // Pendências do card do topo (mesma lógica da tabela Controles: resultado sugerido)
  // =========================
  const executionPendenciesPromise = (async () => {
    let frameworkName = ""
    if (frameworkId) {
      const fwRes = await sql<{ name: string }>`
        SELECT name::text AS name
        FROM frameworks
        WHERE tenant_id = ${tenantId}
          AND id = ${frameworkId}::uuid
        LIMIT 1
      `
      frameworkName = fwRes.rows[0]?.name ?? ""
    }

    const mesRef = `${year}-${String(month).padStart(2, "0")}`
    const page = await fetchControlsPage({
      mes_ref: mesRef,
      framework: frameworkName,
      limit: 0,
    })

    let controls_pending_execution = 0
    let controls_overdue_execution = 0
    let controls_not_applicable = 0

    for (const row of page.rows) {
      const s = String(row.control_result_suggested ?? "pending").toLowerCase()
      if (s === "overdue") controls_overdue_execution++
      else if (s === "not_applicable") controls_not_applicable++
      else if (s === "pending") controls_pending_execution++
    }

    return { controls_pending_execution, controls_overdue_execution, controls_not_applicable }
  })()

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
    perfStatusRes,
    criticalRes,
    executionPendenciesRes,
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
    perfStatusPromise,
    criticalPromise,
    executionPendenciesPromise,
  ])

  const filters: DashboardFilters = { frameworks: frameworksRes.rows }
  const cards = cardsRes.rows[0] ?? {
    controls_ok: 0,
    controls_overdue: 0,
    controls_critical: 0,
    kpis_out_of_target: 0,
  }
  const countsBase = countsRes.rows[0] ?? {
    executions_total: 0,
    executions_pending_grc: 0,
    action_plans_open: 0,
    action_plans_overdue: 0,
  }
  const counts = {
    ...countsBase,
    controls_pending_execution: executionPendenciesRes.controls_pending_execution,
    controls_overdue_execution: executionPendenciesRes.controls_overdue_execution,
    controls_not_applicable: executionPendenciesRes.controls_not_applicable,
  }

  const critical_controls = criticalRes

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
    performance_status_6m: perfStatusRes.rows,
    critical_controls,
  }
}

