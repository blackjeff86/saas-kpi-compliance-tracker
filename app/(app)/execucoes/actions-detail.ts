"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../lib/context"
import { ensureActionPlanForExecution } from "../action-plans/actions"
import { closeActionPlansForExecution } from "../action-plans/actions-close"

export async function fetchExecutionDetail(id: string) {
  const ctx = await getContext()

  const { rows } = await sql`
    SELECT
      e.id,
      c.control_code,
      c.name AS control_name,
      k.kpi_code,
      k.name AS kpi_name,
      e.period_start::text AS period_start,
      e.period_end::text AS period_end,
      e.result_numeric,
      e.result_notes,
      e.auto_status::text AS auto_status,
      e.workflow_status::text AS workflow_status,
      gr.decision::text AS grc_decision,
      gr.review_comment AS grc_comment,
      gr.reviewed_at::text AS grc_reviewed_at
    FROM kpi_executions e
    JOIN controls c ON c.id = e.control_id
    JOIN kpis k ON k.id = e.kpi_id
    LEFT JOIN grc_reviews gr
      ON gr.execution_id = e.id
     AND gr.tenant_id = e.tenant_id
    WHERE e.tenant_id = ${ctx.tenantId}
      AND e.id = ${id}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function fetchEvidences(executionId: string) {
  const ctx = await getContext()

  const { rows } = await sql`
    SELECT
      id,
      title,
      type::text AS type,
      created_at::text AS created_at,
      file_url
    FROM evidences
    WHERE tenant_id = ${ctx.tenantId}
      AND execution_id = ${executionId}
    ORDER BY created_at DESC
  `
  return rows
}

type ReviewDecision = "approved" | "needs_changes" | "rejected"

export async function submitGrcReview(opts: {
  executionId: string
  decision: ReviewDecision
  comment: string
}) {
  const ctx = await getContext()
  const { executionId, decision, comment } = opts

  // garantir que a execução pertence ao tenant atual
  const execRes = await sql`
    SELECT id
    FROM kpi_executions
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${executionId}
    LIMIT 1
  `
  if (!execRes.rows[0]?.id) throw new Error("Execução não encontrada ou fora do tenant.")

  const newWorkflow =
    decision === "approved" ? "approved" :
    decision === "rejected" ? "rejected" :
    "needs_changes"

  // 1) upsert do review (review_comment é NOT NULL no schema)
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
      ${ctx.tenantId},
      ${executionId},
      ${ctx.userId},
      ${decision},
      ${comment},
      NOW()
    )
    ON CONFLICT (tenant_id, execution_id) DO UPDATE
    SET
      reviewer_user_id = EXCLUDED.reviewer_user_id,
      decision = EXCLUDED.decision,
      review_comment = EXCLUDED.review_comment,
      reviewed_at = EXCLUDED.reviewed_at
  `

  // 2) atualiza status da execução
  await sql`
    UPDATE kpi_executions
    SET workflow_status = ${newWorkflow}
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${executionId}
  `

  // 3) Action plans automáticos
  if (decision === "needs_changes" || decision === "rejected") {
    await ensureActionPlanForExecution({
      executionId,
      trigger: "grc_review",
      reason: `GRC marcou como ${decision}. Motivo: ${comment}`,
      dueInDays: 7,
    })
  }

  if (decision === "approved") {
    await closeActionPlansForExecution(executionId)
  }

  // 4) revalidar por último
  revalidatePath(`/execucoes/${executionId}`)
  revalidatePath(`/revisoes`)
  revalidatePath(`/dashboard`)
}
