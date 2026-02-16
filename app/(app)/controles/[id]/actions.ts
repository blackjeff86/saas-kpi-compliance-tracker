"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../../lib/context"

export type ControlDetail = {
  id: string
  control_code: string
  name: string
  framework: string | null
  frequency: string | null
  risk_level: string | null
  created_at: string
}

export type ControlKpiSummaryRow = {
  kpi_id: string
  kpi_code: string
  kpi_name: string
  target_operator: string | null
  target_value: number | null
  last_result: number | null
  last_auto_status: string | null
  last_period_end: string | null
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
      c.created_at::text AS created_at
    FROM controls c
    LEFT JOIN frameworks f ON f.id = c.framework_id
    LEFT JOIN risk_catalog r ON r.id = c.risk_id
    WHERE c.tenant_id = ${ctx.tenantId}
      AND c.id = ${controlId}
    LIMIT 1
  `

  return rows[0] ?? null
}

/**
 * KPIs do controle (baseado em relacionamento observável no schema atual):
 * - Pegamos KPIs que já tiveram pelo menos 1 execução para este controle
 * - E trazemos o "último resultado" via LATERAL
 */
export async function fetchKpisForControl(controlId: string): Promise<ControlKpiSummaryRow[]> {
  const ctx = await getContext()

  const { rows } = await sql<ControlKpiSummaryRow>`
    SELECT DISTINCT
      k.id::text AS kpi_id,
      k.kpi_code::text AS kpi_code,
      k.name::text AS kpi_name,
      k.target_operator::text AS target_operator,
      k.target_value AS target_value,
      le.result_numeric AS last_result,
      le.auto_status::text AS last_auto_status,
      le.period_end::text AS last_period_end
    FROM kpi_executions e
    JOIN kpis k ON k.id = e.kpi_id
    LEFT JOIN LATERAL (
      SELECT
        e2.result_numeric,
        e2.auto_status,
        e2.period_end
      FROM kpi_executions e2
      WHERE e2.tenant_id = ${ctx.tenantId}
        AND e2.control_id = ${controlId}
        AND e2.kpi_id = k.id
      ORDER BY e2.period_end DESC NULLS LAST, e2.created_at DESC
      LIMIT 1
    ) le ON true
    WHERE e.tenant_id = ${ctx.tenantId}
      AND e.control_id = ${controlId}
    ORDER BY k.kpi_code ASC, k.name ASC
  `
  return rows
}

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

/**
 * Timeline simples (não depende de tabela de audit trail):
 * - últimos eventos de execução + criação de plano de ação
 */
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
      k.name::text AS kpi_name,
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

  // ordena por data desc
  items.sort((a, b) => (a.happened_at < b.happened_at ? 1 : -1))
  return items.slice(0, 12)
}
