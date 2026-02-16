"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

export type ControlDetail = {
  id: string
  control_code: string
  name: string
  framework: string | null
  frequency: string | null
  risk_level: string | null
  created_at: string
}

export type ControlKpiRow = {
  id: string
  kpi_code: string
  name: string
  kpi_type: string | null
  target_operator: string | null
  target_value: number | null
  evidence_required: boolean | null

  last_execution_id: string | null
  last_period_end: string | null
  last_result_numeric: number | null
  last_auto_status: string | null
}

export async function fetchControlById(controlId: string): Promise<{
  control: ControlDetail
  kpis: ControlKpiRow[]
}> {
  const ctx = await getContext()

  // =========================
  // CONTROL (com framework + risco)
  // =========================
  const controlRes = await sql<ControlDetail>`
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
  const control = controlRes.rows[0]

  if (!control) {
    // debug: existe em outro tenant?
    const any = await sql<{ tenant_id: string }>`
      SELECT tenant_id::text AS tenant_id
      FROM controls
      WHERE id = ${controlId}
      LIMIT 1
    `

    if (!any.rows[0]) {
      throw new Error(
        `Controle não existe. id=${String(controlId)} ctx.tenantId=${String(ctx.tenantId)}`
      )
    }

    throw new Error(
      `Controle existe, mas tenant mismatch. id=${String(controlId)} controle.tenant_id=${any.rows[0].tenant_id} ctx.tenantId=${String(
        ctx.tenantId
      )}`
    )
  }

  // =========================
  // KPIs associados ao controle (via execuções)
  // - hoje não existe tabela control_kpis, então inferimos pelos registros em kpi_executions
  // - traz último resultado / status por KPI (LATERAL)
  // =========================
  const kpisRes = await sql<ControlKpiRow>`
    SELECT
      k.id,
      k.kpi_code,
      k.name,
      k.kpi_type::text AS kpi_type,
      k.target_operator::text AS target_operator,
      k.target_value,
      k.evidence_required,

      last_exec.id AS last_execution_id,
      last_exec.period_end::text AS last_period_end,
      last_exec.result_numeric AS last_result_numeric,
      last_exec.auto_status::text AS last_auto_status
    FROM kpis k
    JOIN (
      SELECT DISTINCT e.kpi_id
      FROM kpi_executions e
      WHERE e.tenant_id = ${ctx.tenantId}
        AND e.control_id = ${controlId}
    ) used ON used.kpi_id = k.id
    LEFT JOIN LATERAL (
      SELECT
        e.id,
        e.period_end,
        e.result_numeric,
        e.auto_status
      FROM kpi_executions e
      WHERE e.tenant_id = ${ctx.tenantId}
        AND e.control_id = ${controlId}
        AND e.kpi_id = k.id
      ORDER BY e.period_end DESC NULLS LAST, e.created_at DESC
      LIMIT 1
    ) last_exec ON true
    WHERE k.tenant_id = ${ctx.tenantId}
    ORDER BY k.created_at DESC
    LIMIT 200
  `

  return {
    control,
    kpis: kpisRes.rows,
  }
}
