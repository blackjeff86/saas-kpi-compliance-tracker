"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

export type RiskRow = {
  id: string
  title: string
  domain: string
  classification: string
  impact: number
  likelihood: number
  risk_score: number
  status: string
  created_at: string
}

export async function fetchRisks(): Promise<RiskRow[]> {
  const ctx = await getContext()

  const { rows } = await sql<RiskRow>`
    SELECT
      id::text AS id,
      title,
      domain,
      classification::text AS classification,
      impact,
      likelihood,
      risk_score,
      status::text AS status,
      created_at::text AS created_at
    FROM risks
    WHERE tenant_id = ${ctx.tenantId}
    ORDER BY created_at DESC
    LIMIT 200
  `

  return rows
}
