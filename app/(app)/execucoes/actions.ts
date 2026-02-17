"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

export type ExecutionRow = {
  id: string
  control_code: string
  control_name: string
  kpi_code: string
  kpi_name: string
  period_start: string
  period_end: string
  result_numeric: number | null
  auto_status: string
  workflow_status: string
  due_date: string | null
  review_due_date: string | null
}

export async function fetchExecutions(): Promise<ExecutionRow[]> {
  const ctx = await getContext()

  const { rows } = await sql<ExecutionRow>`
    SELECT
      e.id,
      c.control_code,
      c.name AS control_name,
      k.kpi_code,
      k.name AS kpi_name,
      e.period_start::text AS period_start,
      e.period_end::text AS period_end,
      e.result_numeric,
      e.auto_status::text AS auto_status,
      e.workflow_status::text AS workflow_status,
      e.due_date::text AS due_date,
      e.review_due_date::text AS review_due_date
    FROM kpi_executions e
    JOIN controls c ON c.id = e.control_id
    JOIN kpis k ON k.id = e.kpi_id
    WHERE e.tenant_id = ${ctx.tenantId}
    ORDER BY e.period_start DESC, e.created_at DESC
    LIMIT 200;
  `

  return rows
}

export type GrcQueueRow = {
  execution_id: string
  control_code: string
  control_name: string
  kpi_code: string
  kpi_name: string
  period_start: string
  period_end: string
  auto_status: string
  workflow_status: string
  risk_code: string | null
  risk_name: string | null
  risk_classification: "low" | "medium" | "high" | "critical" | null
}

export async function fetchGrcQueue(): Promise<GrcQueueRow[]> {
  const ctx = await getContext()

  const { rows } = await sql<GrcQueueRow>`
    SELECT
      e.id AS execution_id,
      c.control_code,
      c.name AS control_name,
      k.kpi_code,
      k.name AS kpi_name,
      e.period_start::text AS period_start,
      e.period_end::text AS period_end,
      e.auto_status::text AS auto_status,
      e.workflow_status::text AS workflow_status,

      r.risk_code,
      r.name AS risk_name,

      -- ✅ NÃO faz cast pra enum; normaliza texto, incluindo "med"
      CASE
        WHEN r.classification IS NULL THEN NULL
        WHEN lower(trim(r.classification::text)) IN ('critical', 'crítico', 'critico') THEN 'critical'
        WHEN lower(trim(r.classification::text)) IN ('high', 'alto') THEN 'high'
        WHEN lower(trim(r.classification::text)) IN ('medium', 'med', 'moderate', 'médio', 'medio') THEN 'medium'
        WHEN lower(trim(r.classification::text)) IN ('low', 'baixo') THEN 'low'
        ELSE 'medium'
      END AS risk_classification

    FROM kpi_executions e
    JOIN controls c ON c.id = e.control_id AND c.tenant_id = e.tenant_id
    JOIN kpis k ON k.id = e.kpi_id AND k.tenant_id = e.tenant_id
    LEFT JOIN risk_catalog r ON r.id = c.risk_id AND r.tenant_id = e.tenant_id
    WHERE e.tenant_id = ${ctx.tenantId}
    ORDER BY e.period_end DESC
    LIMIT 200;
  `

  return rows
}
