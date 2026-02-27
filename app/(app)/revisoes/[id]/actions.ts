// app/(app)/revisoes/[id]/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../../lib/context"

export type EvidenceRow = {
  id: string
  filename: string
  mime_type: string | null
  created_at: string | null
}

export type ReviewActionPlanRow = {
  id: string
  title: string
  description: string | null
  responsible_name: string | null
  priority: string | null
  status: string | null
  due_date: string | null
  updated_at: string | null
}

export type ReviewDetail = {
  execution: {
    execution_id: string
    control_id: string
    kpi_id: string

    period_start: string
    period_end: string

    result_numeric: number | null
    result_notes: string | null

    // ✅ existe no schema: result_value (text)
    result_value: string | null

    auto_status: string | null

    // status de workflow/revisão
    workflow_status: string | null
    grc_review_status: string | null
    review_due_date: string | null

    // dados do revisor (vem de grc_reviews)
    reviewer_notes: string | null

    // (não existe coluna de ajuste no schema atual; mantemos no retorno como null)
    reviewer_adjusted_result_numeric: number | null

    grc_reviewed_at: string | null
    grc_submitted_at: string | null
  }

  control: {
    control_code: string
    control_name: string
    control_description: string | null
    control_frequency: string | null
    control_owner_name: string | null
    control_owner_email: string | null
  }

  kpi: {
    kpi_code: string
    kpi_name: string
    kpi_description: string | null
    kpi_type: string | null
    target_operator: string | null
    target_value: number | null
    warning_buffer_pct: number | null
    is_active: boolean
  }

  risk: {
    risk_level: string | null
  }

  evidences: EvidenceRow[]
  actionPlans: ReviewActionPlanRow[]

  periodLabel: string
}

function safe(v: any) {
  return String(v ?? "").trim()
}

function formatMonthLabel(yyyyMm: string) {
  if (!/^\d{4}-\d{2}$/.test(yyyyMm)) return yyyyMm
  const [y, m] = yyyyMm.split("-").map((x) => Number(x))
  const monthsPt = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${monthsPt[(m || 1) - 1]}/${y}`
}

function normalizeReviewStatus(v?: string | null) {
  const s = safe(v).toLowerCase()
  if (!s) return ""
  if (s === "in_review") return "under_review"
  return s
}

export async function fetchReviewDetail(input: { executionId: string }): Promise<ReviewDetail | null> {
  const ctx = await getContext()
  const executionId = safe(input.executionId)
  if (!executionId) return null

  const base = await sql<{
    execution_id: string
    control_id: string
    kpi_id: string

    period_start: string
    period_end: string

    result_numeric: any
    result_notes: string | null
    result_value: string | null

    auto_status: string | null

    workflow_status: string | null
    grc_review_status: string | null
    review_due_date: string | null

    grc_reviewed_at: string | null
    grc_submitted_at: string | null

    reviewer_notes: string | null

    control_code: string
    control_name: string
    control_description: string | null
    control_frequency: string | null
    control_owner_name: string | null
    control_owner_email: string | null

    kpi_code: string
    kpi_name: string
    kpi_description: string | null
    kpi_type: string | null
    target_operator: string | null
    target_value: any
    warning_buffer_pct: any
    is_active: boolean | null

    risk_level: string | null
  }>`
    SELECT
      e.id::text AS execution_id,
      e.control_id::text AS control_id,
      e.kpi_id::text AS kpi_id,

      e.period_start::text AS period_start,
      e.period_end::text AS period_end,

      e.result_numeric AS result_numeric,
      e.result_notes::text AS result_notes,
      e.result_value::text AS result_value,

      e.auto_status::text AS auto_status,

      e.workflow_status::text AS workflow_status,
      e.grc_review_status::text AS grc_review_status,
      e.review_due_date::text AS review_due_date,

      e.grc_reviewed_at::text AS grc_reviewed_at,
      e.grc_submitted_at::text AS grc_submitted_at,

      -- ✅ notas do revisor via grc_reviews
      gr.review_comment::text AS reviewer_notes,

      c.control_code::text AS control_code,
      c.name::text AS control_name,
      c.description::text AS control_description,
      c.frequency::text AS control_frequency,
      c.control_owner_name::text AS control_owner_name,
      c.control_owner_email::text AS control_owner_email,

      k.kpi_code::text AS kpi_code,
      k.kpi_name::text AS kpi_name,
      k.kpi_description::text AS kpi_description,
      k.kpi_type::text AS kpi_type,
      k.target_operator::text AS target_operator,
      k.target_value AS target_value,
      k.warning_buffer_pct AS warning_buffer_pct,
      COALESCE(k.is_active, true)::boolean AS is_active,

      CASE
        WHEN r.classification IS NULL THEN NULL
        WHEN lower(trim(r.classification::text)) IN ('medium', 'med', 'moderate', 'médio', 'medio') THEN 'medium'
        WHEN lower(trim(r.classification::text)) IN ('critical', 'crítico', 'critico') THEN 'critical'
        WHEN lower(trim(r.classification::text)) IN ('high', 'alto') THEN 'high'
        WHEN lower(trim(r.classification::text)) IN ('low', 'baixo') THEN 'low'
        ELSE lower(trim(r.classification::text))
      END AS risk_level

    FROM kpi_executions e
    JOIN controls c ON c.id = e.control_id
    JOIN kpis k ON k.id = e.kpi_id
    LEFT JOIN risk_catalog r ON r.id = c.risk_id
    LEFT JOIN grc_reviews gr
      ON gr.execution_id = e.id
     AND gr.tenant_id = e.tenant_id
    WHERE e.tenant_id = ${ctx.tenantId}
      AND e.id = ${executionId}::uuid
    LIMIT 1;
  `

  const row = base.rows?.[0]
  if (!row) return null

  const ev = await sql<EvidenceRow>`
    SELECT
      ev.id::text AS id,
      COALESCE(ev.title::text, ev.file_url::text, ev.id::text) AS filename,
      ev.type::text AS mime_type,
      ev.created_at::text AS created_at
    FROM evidences ev
    WHERE ev.tenant_id = ${ctx.tenantId}
      AND ev.execution_id = ${executionId}::uuid
    ORDER BY ev.created_at DESC
    LIMIT 200;
  `

  const actionPlansRes = await sql<ReviewActionPlanRow>`
    SELECT
      ap.id::text AS id,
      ap.title::text AS title,
      ap.description::text AS description,
      ap.responsible_name::text AS responsible_name,
      ap.priority::text AS priority,
      ap.status::text AS status,
      ap.due_date::text AS due_date,
      ap.updated_at::text AS updated_at
    FROM action_plans ap
    WHERE ap.tenant_id = ${ctx.tenantId}
      AND ap.kpi_id = ${row.kpi_id}::uuid
    ORDER BY ap.created_at DESC
    LIMIT 20;
  `

  const rawReviewStatus = row.grc_review_status || row.workflow_status
  const reviewStatus = normalizeReviewStatus(rawReviewStatus)

  const periodLabel = row.period_start ? formatMonthLabel(String(row.period_start).slice(0, 7)) : "—"

  const resultNumeric =
    row.result_numeric === null || row.result_numeric === undefined ? null : Number(row.result_numeric)

  const targetValue =
    row.target_value === null || row.target_value === undefined ? null : Number(row.target_value)

  const warningBuffer =
    row.warning_buffer_pct === null || row.warning_buffer_pct === undefined ? null : Number(row.warning_buffer_pct)

  return {
    execution: {
      execution_id: String(row.execution_id),
      control_id: String(row.control_id),
      kpi_id: String(row.kpi_id),

      period_start: String(row.period_start ?? ""),
      period_end: String(row.period_end ?? ""),

      result_numeric: Number.isFinite(resultNumeric as number) ? resultNumeric : null,
      result_notes: row.result_notes ?? null,
      result_value: row.result_value ?? null,

      auto_status: row.auto_status ? String(row.auto_status).toLowerCase() : null,

      workflow_status: row.workflow_status ? String(row.workflow_status) : null,
      grc_review_status: reviewStatus || null,
      review_due_date: row.review_due_date ?? null,

      reviewer_notes: row.reviewer_notes ?? null,
      reviewer_adjusted_result_numeric: null,

      grc_reviewed_at: row.grc_reviewed_at ?? null,
      grc_submitted_at: row.grc_submitted_at ?? null,
    },
    control: {
      control_code: String(row.control_code ?? ""),
      control_name: String(row.control_name ?? ""),
      control_description: row.control_description ?? null,
      control_frequency: row.control_frequency ?? null,
      control_owner_name: row.control_owner_name ?? null,
      control_owner_email: row.control_owner_email ?? null,
    },
    kpi: {
      kpi_code: String(row.kpi_code ?? ""),
      kpi_name: String(row.kpi_name ?? ""),
      kpi_description: row.kpi_description ?? null,
      kpi_type: row.kpi_type ?? null,
      target_operator: row.target_operator ?? null,
      target_value: Number.isFinite(targetValue as number) ? targetValue : null,
      warning_buffer_pct: Number.isFinite(warningBuffer as number) ? warningBuffer : null,
      is_active: Boolean(row.is_active),
    },
    risk: {
      risk_level: row.risk_level ?? null,
    },
    evidences: ev.rows ?? [],
    actionPlans: actionPlansRes.rows ?? [],
    periodLabel,
  }
}

export type FinalizeReviewInput = {
  executionId: string
  reviewerAdjustedResultNumeric: number | null
  decision: "approved" | "needs_changes" | "rejected" | "under_review"
  reviewerNotes: string | null
}

export async function finalizeReview(input: FinalizeReviewInput): Promise<{ ok: true }> {
  const ctx = await getContext()

  const executionId = safe(input.executionId)
  if (!executionId) throw new Error("executionId inválido.")

  const decision = safe(input.decision) as FinalizeReviewInput["decision"]
  const allowed = new Set(["approved", "needs_changes", "rejected", "under_review"])
  if (!allowed.has(decision)) throw new Error("Decisão inválida.")

  // 1) Persiste status da revisão na execução
  // ✅ schema real: NÃO existe result_text; usamos result_value (text)
  await sql`
    UPDATE kpi_executions
    SET
      grc_review_status = ${decision},
      result_numeric = COALESCE(${input.reviewerAdjustedResultNumeric}::numeric, result_numeric),
      result_value = COALESCE(${input.reviewerNotes}::text, result_value),
      grc_reviewed_at = NOW()
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${executionId}::uuid;
  `

  // 2) Persiste comentário/decisão em grc_reviews (tabela de reviews)
  if (decision !== "under_review") {
    await sql`
      INSERT INTO grc_reviews (
        tenant_id,
        execution_id,
        reviewer_user_id,
        decision,
        review_comment,
        reviewed_at
      )
      VALUES (
        ${ctx.tenantId}::uuid,
        ${executionId}::uuid,
        ${ctx.userId ?? null}::uuid,
        ${decision},
        ${input.reviewerNotes ?? "Sem comentário."},
        NOW()
      )
      ON CONFLICT (tenant_id, execution_id) DO UPDATE
      SET
        reviewer_user_id = EXCLUDED.reviewer_user_id,
        decision = EXCLUDED.decision,
        review_comment = EXCLUDED.review_comment,
        reviewed_at = EXCLUDED.reviewed_at;
    `
  }

  return { ok: true }
}
