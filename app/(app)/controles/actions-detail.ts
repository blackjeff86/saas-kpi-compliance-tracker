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

export type ControlPeriodStatus =
  | "effective"
  | "gap"
  | "out_of_standard"
  | "not_executed"

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

async function tableExists(tableName: string): Promise<boolean> {
  const r = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS exists
  `
  return Boolean(r.rows?.[0]?.exists)
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const r = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
        AND column_name = ${columnName}
    ) AS exists
  `
  return Boolean(r.rows?.[0]?.exists)
}

function aggregateControlStatus(rows: ControlKpiRow[]): ControlPeriodStatus {
  const statuses = rows.map((r) => (r.last_auto_status || "").toLowerCase())
  if (statuses.some((s) => s === "out")) return "out_of_standard"
  if (statuses.some((s) => s === "warning")) return "gap"
  if (statuses.some((s) => s === "in_target")) return "effective"
  return "not_executed"
}

async function getLatestPeriodEndForControl(params: {
  tenantId: string
  controlId: string
}): Promise<string | null> {
  const r = await sql<{ period_end: string | null }>`
    SELECT MAX(e.period_end)::text AS period_end
    FROM kpi_executions e
    WHERE e.tenant_id = ${params.tenantId}
      AND e.control_id = ${params.controlId}
  `
  return r.rows?.[0]?.period_end ?? null
}

export async function fetchControlById(
  controlId: string,
  periodEnd?: string | null
): Promise<{
  control: ControlDetail
  period_end_used: string | null
  control_period_status: ControlPeriodStatus
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
  // Determinar período a usar
  // =========================
  const period_end_used =
    (periodEnd && String(periodEnd)) ||
    (await getLatestPeriodEndForControl({ tenantId: ctx.tenantId, controlId }))

  // =========================
  // KPIs associados ao controle
  // =========================
  const hasControlKpis = await tableExists("control_kpis")
  const hasKpiControlId = !hasControlKpis && (await columnExists("kpis", "control_id"))

  if (hasControlKpis) {
    const kpisRes = await sql<ControlKpiRow>`
      SELECT
        k.id,
        k.kpi_code,
        k.kpi_name,
        k.kpi_type::text AS kpi_type,
        k.target_operator::text AS target_operator,
        k.target_value,
        k.evidence_required,

        last_exec.id AS last_execution_id,
        last_exec.period_end::text AS last_period_end,
        last_exec.result_numeric AS last_result_numeric,
        last_exec.auto_status::text AS last_auto_status
      FROM control_kpis ck
      JOIN kpis k
        ON k.id = ck.kpi_id
       AND k.tenant_id = ${ctx.tenantId}
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
          AND (${period_end_used}::date IS NULL OR e.period_end = ${period_end_used}::date)
        ORDER BY e.period_end DESC NULLS LAST, e.created_at DESC
        LIMIT 1
      ) last_exec ON true
      WHERE ck.tenant_id = ${ctx.tenantId}
        AND ck.control_id = ${controlId}
      ORDER BY k.created_at DESC
      LIMIT 200
    `

    const kpis = kpisRes.rows
    return {
      control,
      period_end_used,
      control_period_status: aggregateControlStatus(kpis),
      kpis,
    }
  }

  if (hasKpiControlId) {
    const kpisRes = await sql<ControlKpiRow>`
      SELECT
        k.id,
        k.kpi_code,
        k.kpi_name,
        k.kpi_type::text AS kpi_type,
        k.target_operator::text AS target_operator,
        k.target_value,
        k.evidence_required,

        last_exec.id AS last_execution_id,
        last_exec.period_end::text AS last_period_end,
        last_exec.result_numeric AS last_result_numeric,
        last_exec.auto_status::text AS last_auto_status
      FROM kpis k
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
          AND (${period_end_used}::date IS NULL OR e.period_end = ${period_end_used}::date)
        ORDER BY e.period_end DESC NULLS LAST, e.created_at DESC
        LIMIT 1
      ) last_exec ON true
      WHERE k.tenant_id = ${ctx.tenantId}
        AND k.control_id = ${controlId}::uuid
      ORDER BY k.created_at DESC
      LIMIT 200
    `

    const kpis = kpisRes.rows
    return {
      control,
      period_end_used,
      control_period_status: aggregateControlStatus(kpis),
      kpis,
    }
  }

  // =========================
  // FALLBACK
  // =========================
  const kpisRes = await sql<ControlKpiRow>`
    SELECT
      k.id,
      k.kpi_code,
      k.kpi_name,
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
        AND (${period_end_used}::date IS NULL OR e.period_end = ${period_end_used}::date)
      ORDER BY e.period_end DESC NULLS LAST, e.created_at DESC
      LIMIT 1
    ) last_exec ON true
    WHERE k.tenant_id = ${ctx.tenantId}
    ORDER BY k.created_at DESC
    LIMIT 200
  `

  const kpis = kpisRes.rows
  return {
    control,
    period_end_used,
    control_period_status: aggregateControlStatus(kpis),
    kpis,
  }
}
