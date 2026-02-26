// app/(app)/revisoes/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

export type GrcQueueRow = {
  execution_id: string

  control_code: string
  control_name: string

  kpi_code: string
  kpi_name: string

  period_start: string
  period_end: string

  workflow_status: string
  auto_status: string

  review_due_date: string | null

  risk_level: string | null

  evidence_count: number
  has_evidence: boolean
  last_evidence_at: string | null
}

export async function fetchGrcQueue(): Promise<GrcQueueRow[]> {
  const ctx = await getContext()

  const { rows } = await sql<GrcQueueRow>`
    SELECT
      e.id AS execution_id,
      c.control_code,
      c.name AS control_name,
      k.kpi_code,
      k.kpi_name AS kpi_name,

      e.period_start::text AS period_start,
      e.period_end::text AS period_end,

      e.workflow_status::text AS workflow_status,
      e.auto_status::text AS auto_status,
      e.review_due_date::text AS review_due_date,

      -- ✅ normaliza "med" (legado) -> "medium"
      CASE
        WHEN r.classification IS NULL THEN NULL
        WHEN lower(trim(r.classification::text)) IN ('medium', 'med', 'moderate', 'médio', 'medio') THEN 'medium'
        WHEN lower(trim(r.classification::text)) IN ('critical', 'crítico', 'critico') THEN 'critical'
        WHEN lower(trim(r.classification::text)) IN ('high', 'alto') THEN 'high'
        WHEN lower(trim(r.classification::text)) IN ('low', 'baixo') THEN 'low'
        ELSE lower(trim(r.classification::text))
      END AS risk_level,

      -- ⭐ evidências por execução
      COUNT(ev.id)::int AS evidence_count,
      CASE WHEN COUNT(ev.id) > 0 THEN true ELSE false END AS has_evidence,
      MAX(ev.created_at)::text AS last_evidence_at

    FROM kpi_executions e
    JOIN controls c ON c.id = e.control_id
    JOIN kpis k ON k.id = e.kpi_id
    LEFT JOIN risk_catalog r ON r.id = c.risk_id

    LEFT JOIN evidences ev
      ON ev.execution_id = e.id
      AND ev.tenant_id = e.tenant_id

    WHERE e.tenant_id = ${ctx.tenantId}
      AND e.workflow_status IN ('submitted','under_review','needs_changes')

    GROUP BY
      e.id,
      c.control_code,
      c.name,
      k.kpi_code,
      k.kpi_name,
      e.period_start,
      e.period_end,
      e.workflow_status,
      e.auto_status,
      e.review_due_date,
      r.classification

    ORDER BY
      -- ✅ risco mais crítico primeiro
      CASE
        WHEN r.classification IS NULL THEN 0
        WHEN lower(trim(r.classification::text)) IN ('critical', 'crítico', 'critico') THEN 4
        WHEN lower(trim(r.classification::text)) IN ('high', 'alto') THEN 3
        WHEN lower(trim(r.classification::text)) IN ('medium', 'med', 'moderate', 'médio', 'medio') THEN 2
        WHEN lower(trim(r.classification::text)) IN ('low', 'baixo') THEN 1
        ELSE 1
      END DESC,

      -- ✅ itens com menos evidência primeiro
      COUNT(ev.id) ASC,

      -- ✅ depois: due date
      e.review_due_date ASC NULLS LAST,

      -- ✅ depois: período mais recente
      e.period_start DESC,

      e.created_at DESC

    LIMIT 200;
  `

  return rows
}