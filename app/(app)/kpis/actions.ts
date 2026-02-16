"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

export type KpiRow = {
  id: string
  kpi_code: string
  name: string
  kpi_type: string | null
  target_operator: string | null
  target_value: number | null
  evidence_required: boolean | null
  created_at: string
}

export async function fetchKpis(): Promise<KpiRow[]> {
  const ctx = await getContext()

  const { rows } = await sql<KpiRow>`
    SELECT
      id,
      kpi_code,
      name,
      kpi_type::text AS kpi_type,
      target_operator::text AS target_operator,
      target_value,
      evidence_required,
      created_at::text AS created_at
    FROM kpis
    WHERE tenant_id = ${ctx.tenantId}
    ORDER BY created_at DESC
    LIMIT 200
  `
  return rows
}
