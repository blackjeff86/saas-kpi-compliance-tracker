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
