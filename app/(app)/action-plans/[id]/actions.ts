"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../../lib/context"

export type ActionPlanDetail = {
  id: string
  title: string
  description: string | null
  responsible_name: string | null
  priority: string | null
  status: string | null
  due_date: string | null
  created_at: string | null
  updated_at: string

  execution_id: string | null
  risk_id: string | null

  control_code: string | null
  kpi_code: string | null

  risk_title: string | null
  risk_classification: string | null

  framework: string | null
  mes_ref: string | null
}

export async function fetchActionPlanDetail(
  id: string
): Promise<ActionPlanDetail | null> {
  const ctx = await getContext()

  const { rows } = await sql<ActionPlanDetail>`
    SELECT
      ap.id,
      ap.title,
      ap.description,
      ap.responsible_name,
      ap.priority::text,
      ap.status::text,
      ap.due_date::text,
      ap.created_at::text,
      ap.updated_at::text,

      ap.execution_id,
      ap.risk_id,
      to_char(date_trunc('month', e.period_start), 'YYYY-MM')::text AS mes_ref,

      c.control_code,
      k.kpi_code,

      r.title AS risk_title,
      r.classification::text AS risk_classification,

      COALESCE(fc.name, fk.name)::text AS framework

    FROM action_plans ap

    LEFT JOIN controls c
      ON c.id = ap.control_id
     AND c.tenant_id = ap.tenant_id
    LEFT JOIN kpi_executions e
      ON e.id = ap.execution_id
     AND e.tenant_id = ap.tenant_id

    LEFT JOIN kpis k
      ON k.id = ap.kpi_id
     AND k.tenant_id = ap.tenant_id
    LEFT JOIN controls ck
      ON ck.id = k.control_id
     AND ck.tenant_id = ap.tenant_id
    LEFT JOIN frameworks fc
      ON fc.id = c.framework_id
    LEFT JOIN frameworks fk
      ON fk.id = ck.framework_id

    LEFT JOIN risks r
      ON r.id = ap.risk_id
     AND r.tenant_id = ap.tenant_id

    WHERE ap.tenant_id = ${ctx.tenantId}
      AND ap.id = ${id}::uuid

    LIMIT 1
  `

  return rows[0] ?? null
}
