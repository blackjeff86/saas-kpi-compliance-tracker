"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

export type ActionPlanListRow = {
  id: string
  title: string
  priority: string | null
  status: string | null
  due_date: string | null
  updated_at: string

  // origem execution
  execution_id: string | null
  control_code: string | null
  kpi_code: string | null
  auto_status: string | null
  workflow_status: string | null

  // origem risk
  risk_id: string | null
  risk_title: string | null
  risk_classification: string | null
}

export async function fetchActionPlans(input?: { riskId?: string }): Promise<ActionPlanListRow[]> {
  const ctx = await getContext()
  const riskId = input?.riskId?.trim() || null

  const { rows } = await sql<ActionPlanListRow>`
    SELECT
      ap.id,
      ap.title,
      ap.priority::text AS priority,
      ap.status::text AS status,
      ap.due_date::text AS due_date,
      ap.updated_at::text AS updated_at,

      ap.execution_id,
      c.control_code,
      k.kpi_code,
      e.auto_status::text AS auto_status,
      e.workflow_status::text AS workflow_status,

      ap.risk_id,
      r.title AS risk_title,
      r.classification::text AS risk_classification

    FROM action_plans ap
    LEFT JOIN kpi_executions e
      ON e.id = ap.execution_id
     AND e.tenant_id = ap.tenant_id
    LEFT JOIN controls c
      ON c.id = ap.control_id
     AND c.tenant_id = ap.tenant_id
    LEFT JOIN kpis k
      ON k.id = ap.kpi_id
     AND k.tenant_id = ap.tenant_id

    LEFT JOIN risks r
      ON r.id = ap.risk_id
     AND r.tenant_id = ap.tenant_id

    WHERE ap.tenant_id = ${ctx.tenantId}
      AND (${riskId}::uuid IS NULL OR ap.risk_id = ${riskId}::uuid)

    ORDER BY ap.updated_at DESC
    LIMIT 200
  `
  return rows
}
