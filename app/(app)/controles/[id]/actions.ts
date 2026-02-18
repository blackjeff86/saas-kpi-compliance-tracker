// app/(app)/controles/[id]/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../../lib/context"

// =============================
// TYPES
// =============================

export type ControlDetail = {
  id: string
  control_code: string
  name: string
  framework: string | null
  frequency: string | null
  risk_level: string | null
  created_at: string

  // ✅ NOVO: campos do controle
  description: string | null
  goal: string | null

  control_owner_name: string | null
  control_owner_email: string | null
  focal_point_name: string | null
  focal_point_email: string | null

  // ✅ NOVO: dados do risco
  risk_id: string | null
  risk_name: string | null
  risk_description: string | null
}

export type ControlKpiSummaryRow = {
  kpi_id: string
  kpi_code: string
  kpi_name: string
  target_operator: string | null
  target_value: number | null

  period_result: number | null
  period_auto_status: string | null
  period_end: string | null
}

export type ActionPlanRow = {
  id: string
  title: string
  priority: string
  status: string
  due_date: string | null
  created_at: string
}

export type ControlHistoryRow = {
  kind: "execution" | "action_plan"
  title: string
  subtitle: string
  happened_at: string
}

// =============================
// HELPERS
// =============================

function norm(v: any) {
  return String(v ?? "").trim()
}

function toSelectedMonthDate(mes_ref?: string | null) {
  const mr = norm(mes_ref)
  if (!mr) return null
  if (!/^\d{4}-\d{2}$/.test(mr)) return null
  return mr
}

export async function fetchControlMonthsOptions(): Promise<string[]> {
  const { rows } = await sql<{ v: string }>`
    SELECT to_char(d::date, 'YYYY-MM') AS v
    FROM generate_series(
      date '2026-01-01',
      date '2027-12-01',
      interval '1 month'
    ) AS d
    ORDER BY v DESC
  `
  return rows.map((r) => r.v)
}

// =============================
// DETAIL (control)
// =============================

export async function fetchControlDetail(controlId: string): Promise<ControlDetail | null> {
  const ctx = await getContext()

  const { rows } = await sql<ControlDetail>`
    SELECT
      c.id,
      c.control_code,
      c.name,
      f.name::text AS framework,
      c.frequency::text AS frequency,
      r.classification::text AS risk_level,
      c.created_at::text AS created_at,

      -- ✅ NOVO: description e goal do controle
      c.description::text AS description,
      c.goal::text        AS goal,

      c.control_owner_name::text  AS control_owner_name,
      c.control_owner_email::text AS control_owner_email,
      c.focal_point_name::text    AS focal_point_name,
      c.focal_point_email::text   AS focal_point_email,

      -- ✅ NOVO: dados do risco
      r.risk_code::text     AS risk_id,
      r.title::text         AS risk_name,
      r.description::text   AS risk_description

    FROM controls c
    LEFT JOIN frameworks f ON f.id = c.framework_id
    LEFT JOIN risk_catalog r ON r.id = c.risk_id
    WHERE c.tenant_id = ${ctx.tenantId}
      AND c.id = ${controlId}
    LIMIT 1
  `

  return rows[0] ?? null
}

// =============================
// KPIs (por mês selecionado)
// =============================

export async function fetchKpisForControl(controlId: string, mes_ref?: string | null): Promise<ControlKpiSummaryRow[]> {
  const ctx = await getContext()
  const mr = toSelectedMonthDate(mes_ref) ?? "" // YYYY-MM

  const { rows } = await sql<ControlKpiSummaryRow>`
    WITH selected_month AS (
      SELECT
        CASE
          WHEN ${mr} = '' THEN date_trunc('month', now())::date
          ELSE to_date(${mr} || '-01', 'YYYY-MM-DD')
        END AS m
    ),
    latest_exec_in_month AS (
      SELECT DISTINCT ON (ke.kpi_id)
        ke.kpi_id,
        ke.result_numeric,
        ke.auto_status::text AS auto_status,
        ke.period_end::text  AS period_end,
        ke.period_start
      FROM kpi_executions ke
      CROSS JOIN selected_month sm
      WHERE ke.tenant_id = ${ctx.tenantId}
        AND ke.control_id = ${controlId}
        AND ke.period_start IS NOT NULL
        AND date_trunc('month', ke.period_start)::date = sm.m
      ORDER BY ke.kpi_id, ke.period_start DESC, ke.created_at DESC
    )
    SELECT
      k.id::text AS kpi_id,
      k.kpi_code::text AS kpi_code,
      k.kpi_name::text AS kpi_name,
      k.target_operator::text AS target_operator,
      k.target_value AS target_value,

      le.result_numeric AS period_result,
      le.auto_status::text AS period_auto_status,
      le.period_end::text AS period_end

    FROM kpis k
    LEFT JOIN latest_exec_in_month le ON le.kpi_id = k.id
    WHERE k.tenant_id = ${ctx.tenantId}
      AND k.control_id = ${controlId}
    ORDER BY k.kpi_code ASC, k.kpi_name ASC
  `
  return rows
}

// =============================
// CONTROL aggregated status (por mês selecionado)
// =============================

export async function fetchControlPeriodStatus(controlId: string, mes_ref?: string | null): Promise<{
  mes_ref_used: string
  control_period_status: "gap" | "warning" | "ok" | "no-data"
}> {
  const ctx = await getContext()
  const mr = toSelectedMonthDate(mes_ref) ?? ""

  const { rows } = await sql<{
    mes_ref_used: string
    worst_sev: number
  }>`
    WITH selected_month AS (
      SELECT
        CASE
          WHEN ${mr} = '' THEN date_trunc('month', now())::date
          ELSE to_date(${mr} || '-01', 'YYYY-MM-DD')
        END AS m
    ),
    latest_exec_in_month AS (
      SELECT DISTINCT ON (ke.kpi_id)
        ke.kpi_id,
        ke.auto_status::text AS auto_status
      FROM kpi_executions ke
      CROSS JOIN selected_month sm
      WHERE ke.tenant_id = ${ctx.tenantId}
        AND ke.control_id = ${controlId}
        AND ke.period_start IS NOT NULL
        AND date_trunc('month', ke.period_start)::date = sm.m
      ORDER BY ke.kpi_id, ke.period_start DESC, ke.created_at DESC
    )
    SELECT
      (SELECT to_char(m, 'YYYY-MM') FROM selected_month)::text AS mes_ref_used,
      MAX(
        CASE
          WHEN lower(COALESCE(le.auto_status, '')) IN ('red', 'gap', 'critical', 'high', 'fail', 'failed', 'ineffective', 'inefetivo') THEN 3
          WHEN lower(COALESCE(le.auto_status, '')) IN ('yellow', 'warning', 'warn', 'medium', 'moderate') THEN 2
          WHEN lower(COALESCE(le.auto_status, '')) IN ('green', 'ok', 'pass', 'passed', 'success', 'effective', 'efetivo') THEN 1
          ELSE 0
        END
      )::int AS worst_sev
    FROM kpis k
    LEFT JOIN latest_exec_in_month le ON le.kpi_id = k.id
    WHERE k.tenant_id = ${ctx.tenantId}
      AND k.control_id = ${controlId}
  `

  const mes_ref_used = rows?.[0]?.mes_ref_used ?? ""
  const worst = rows?.[0]?.worst_sev ?? 0

  const control_period_status =
    worst === 3 ? "gap" : worst === 2 ? "warning" : worst === 1 ? "ok" : "no-data"

  return { mes_ref_used, control_period_status }
}

// =============================
// COMBINED
// =============================

export async function fetchControlById(controlId: string, mes_ref?: string | null) {
  const [control, months, kpis, period] = await Promise.all([
    fetchControlDetail(controlId),
    fetchControlMonthsOptions(),
    fetchKpisForControl(controlId, mes_ref),
    fetchControlPeriodStatus(controlId, mes_ref),
  ])

  if (!control) throw new Error("Controle não existe ou não pertence ao tenant.")

  return {
    control,
    months,
    kpis,
    mes_ref_used: period.mes_ref_used,
    control_period_status: period.control_period_status,
  }
}

// =============================
// ACTION PLANS / HISTORY (mantidos)
// =============================

export async function fetchOpenActionPlansForControl(controlId: string): Promise<ActionPlanRow[]> {
  const ctx = await getContext()

  const { rows } = await sql<ActionPlanRow>`
    SELECT
      ap.id::text AS id,
      ap.title::text AS title,
      ap.priority::text AS priority,
      ap.status::text AS status,
      ap.due_date::text AS due_date,
      ap.created_at::text AS created_at
    FROM action_plans ap
    WHERE ap.tenant_id = ${ctx.tenantId}
      AND ap.control_id = ${controlId}
      AND ap.status::text <> 'done'
    ORDER BY ap.due_date ASC NULLS LAST, ap.priority DESC, ap.created_at DESC
    LIMIT 20
  `
  return rows
}

export async function fetchControlHistory(controlId: string): Promise<ControlHistoryRow[]> {
  const ctx = await getContext()

  const execRes = await sql<{
    created_at: string
    kpi_code: string
    kpi_name: string
    auto_status: string
    period_end: string
  }>`
    SELECT
      e.created_at::text AS created_at,
      k.kpi_code::text AS kpi_code,
      k.kpi_name::text AS kpi_name,
      e.auto_status::text AS auto_status,
      e.period_end::text AS period_end
    FROM kpi_executions e
    JOIN kpis k ON k.id = e.kpi_id
    WHERE e.tenant_id = ${ctx.tenantId}
      AND e.control_id = ${controlId}
    ORDER BY e.created_at DESC
    LIMIT 10
  `

  const apRes = await sql<{
    created_at: string
    title: string
    priority: string
    status: string
  }>`
    SELECT
      ap.created_at::text AS created_at,
      ap.title::text AS title,
      ap.priority::text AS priority,
      ap.status::text AS status
    FROM action_plans ap
    WHERE ap.tenant_id = ${ctx.tenantId}
      AND ap.control_id = ${controlId}
    ORDER BY ap.created_at DESC
    LIMIT 10
  `

  const items: ControlHistoryRow[] = []

  for (const e of execRes.rows) {
    items.push({
      kind: "execution",
      title: `Execução registrada • ${e.kpi_code}`,
      subtitle: `${e.kpi_name} • auto_status: ${e.auto_status} • período fim: ${e.period_end ?? "—"}`,
      happened_at: e.created_at,
    })
  }

  for (const ap of apRes.rows) {
    items.push({
      kind: "action_plan",
      title: `Plano de ação criado`,
      subtitle: `${ap.title} • prioridade: ${ap.priority} • status: ${ap.status}`,
      happened_at: ap.created_at,
    })
  }

  items.sort((a, b) => (a.happened_at < b.happened_at ? 1 : -1))
  return items.slice(0, 12)
}
