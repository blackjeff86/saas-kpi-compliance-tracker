// app/(app)/revisoes/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

export type GrcQueueRow = {
  execution_id: string

  control_code: string
  control_name: string
  control_owner_name: string | null
  control_owner_email: string | null

  kpi_code: string
  kpi_name: string
  result_numeric: number | null

  period_start: string
  period_end: string

  // ✅ prioriza grc_review_status (novo), fallback workflow_status (legado)
  workflow_status: string
  reviewer_decision: string | null
  auto_status: string

  review_due_date: string | null

  risk_level: string | null

  evidence_count: number
  has_evidence: boolean
  last_evidence_at: string | null
}

export async function fetchGrcQueueFilterOptions(): Promise<{ months: string[] }> {
  const { rows } = await sql<{ v: string }>`
    SELECT to_char(d::date, 'YYYY-MM') AS v
    FROM generate_series(date '2026-01-01', date '2027-12-01', interval '1 month') AS d
    ORDER BY v DESC
  `
  return { months: rows.map((r) => r.v) }
}

export async function fetchGrcQueue(input: { mes_ref?: string } = {}): Promise<GrcQueueRow[]> {
  const ctx = await getContext()
  const mes_ref = String(input?.mes_ref ?? "").trim()

  const { rows } = await sql<GrcQueueRow>`
    WITH selected_month AS (
      SELECT
        CASE
          WHEN ${mes_ref} = '' THEN date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date
          WHEN ${mes_ref} ~ '^\\d{4}-\\d{2}$' THEN to_date(${mes_ref} || '-01', 'YYYY-MM-DD')::date
          ELSE date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date
        END AS m
    ),
    latest_exec_in_month AS (
      SELECT DISTINCT ON (e.kpi_id)
        e.*
      FROM kpi_executions e
      CROSS JOIN selected_month sm
      WHERE e.tenant_id = ${ctx.tenantId}
        AND e.period_start IS NOT NULL
        AND date_trunc('month', e.period_start)::date = sm.m
      ORDER BY e.kpi_id, e.period_start DESC, e.created_at DESC
    )
    SELECT
      e.id::text AS execution_id,

      c.control_code::text AS control_code,
      c.name::text AS control_name,
      c.control_owner_name::text AS control_owner_name,
      c.control_owner_email::text AS control_owner_email,

      k.kpi_code::text AS kpi_code,
      k.kpi_name::text AS kpi_name,

      e.result_numeric AS result_numeric,

      e.period_start::text AS period_start,
      e.period_end::text   AS period_end,

      -- ✅ status: novo (grc_review_status) > legado (workflow_status) > pending
      -- ✅ normaliza "in_review" -> "under_review"
      (
        CASE lower(trim(COALESCE(e.grc_review_status::text, e.workflow_status::text, 'pending')))
          WHEN 'in_review' THEN 'under_review'
          ELSE lower(trim(COALESCE(e.grc_review_status::text, e.workflow_status::text, 'pending')))
        END
      )::text AS workflow_status,
      gr.decision::text AS reviewer_decision,

      COALESCE(e.auto_status::text, '') AS auto_status,
      e.review_due_date::text AS review_due_date,

      -- ✅ normaliza risco (legado)
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

    FROM latest_exec_in_month e
    JOIN controls c
      ON c.id = e.control_id
     AND c.tenant_id = e.tenant_id
    JOIN kpis k
      ON k.id = e.kpi_id
     AND k.tenant_id = e.tenant_id
    LEFT JOIN risk_catalog r
      ON r.id = c.risk_id

    LEFT JOIN evidences ev
      ON ev.execution_id = e.id
     AND ev.tenant_id = e.tenant_id
    LEFT JOIN grc_reviews gr
      ON gr.execution_id = e.id
     AND gr.tenant_id = e.tenant_id

    WHERE e.tenant_id = ${ctx.tenantId}
      -- ✅ fila de revisões: usa o status novo, mas mantém compatibilidade com o legado
      AND (
        CASE lower(trim(COALESCE(e.grc_review_status::text, e.workflow_status::text, 'pending')))
          WHEN 'in_review' THEN 'under_review'
          ELSE lower(trim(COALESCE(e.grc_review_status::text, e.workflow_status::text, 'pending')))
        END
      ) IN ('submitted', 'under_review', 'needs_changes', 'approved', 'rejected')

    GROUP BY
      e.id,
      c.control_code,
      c.name,
      c.control_owner_name,
      c.control_owner_email,
      k.kpi_code,
      k.kpi_name,
      e.result_numeric,
      e.period_start,
      e.period_end,
      e.grc_review_status,
      e.workflow_status,
      gr.decision,
      e.auto_status,
      e.review_due_date,
      e.created_at,
      r.classification

    ORDER BY
      -- ✅ risco mais crítico primeiro (coerente com o risk_level normalizado)
      CASE
        WHEN (
          CASE
            WHEN r.classification IS NULL THEN NULL
            WHEN lower(trim(r.classification::text)) IN ('medium', 'med', 'moderate', 'médio', 'medio') THEN 'medium'
            WHEN lower(trim(r.classification::text)) IN ('critical', 'crítico', 'critico') THEN 'critical'
            WHEN lower(trim(r.classification::text)) IN ('high', 'alto') THEN 'high'
            WHEN lower(trim(r.classification::text)) IN ('low', 'baixo') THEN 'low'
            ELSE lower(trim(r.classification::text))
          END
        ) IS NULL THEN 0
        WHEN (
          CASE
            WHEN r.classification IS NULL THEN NULL
            WHEN lower(trim(r.classification::text)) IN ('medium', 'med', 'moderate', 'médio', 'medio') THEN 'medium'
            WHEN lower(trim(r.classification::text)) IN ('critical', 'crítico', 'critico') THEN 'critical'
            WHEN lower(trim(r.classification::text)) IN ('high', 'alto') THEN 'high'
            WHEN lower(trim(r.classification::text)) IN ('low', 'baixo') THEN 'low'
            ELSE lower(trim(r.classification::text))
          END
        ) = 'critical' THEN 4
        WHEN (
          CASE
            WHEN r.classification IS NULL THEN NULL
            WHEN lower(trim(r.classification::text)) IN ('medium', 'med', 'moderate', 'médio', 'medio') THEN 'medium'
            WHEN lower(trim(r.classification::text)) IN ('critical', 'crítico', 'critico') THEN 'critical'
            WHEN lower(trim(r.classification::text)) IN ('high', 'alto') THEN 'high'
            WHEN lower(trim(r.classification::text)) IN ('low', 'baixo') THEN 'low'
            ELSE lower(trim(r.classification::text))
          END
        ) = 'high' THEN 3
        WHEN (
          CASE
            WHEN r.classification IS NULL THEN NULL
            WHEN lower(trim(r.classification::text)) IN ('medium', 'med', 'moderate', 'médio', 'medio') THEN 'medium'
            WHEN lower(trim(r.classification::text)) IN ('critical', 'crítico', 'critico') THEN 'critical'
            WHEN lower(trim(r.classification::text)) IN ('high', 'alto') THEN 'high'
            WHEN lower(trim(r.classification::text)) IN ('low', 'baixo') THEN 'low'
            ELSE lower(trim(r.classification::text))
          END
        ) = 'medium' THEN 2
        WHEN (
          CASE
            WHEN r.classification IS NULL THEN NULL
            WHEN lower(trim(r.classification::text)) IN ('medium', 'med', 'moderate', 'médio', 'medio') THEN 'medium'
            WHEN lower(trim(r.classification::text)) IN ('critical', 'crítico', 'critico') THEN 'critical'
            WHEN lower(trim(r.classification::text)) IN ('high', 'alto') THEN 'high'
            WHEN lower(trim(r.classification::text)) IN ('low', 'baixo') THEN 'low'
            ELSE lower(trim(r.classification::text))
          END
        ) = 'low' THEN 1
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
