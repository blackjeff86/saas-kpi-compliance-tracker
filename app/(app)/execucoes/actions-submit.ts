"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../lib/context"
import { recomputeExecutionAutoStatus } from "./actions-auto-status"
import { ensureActionPlanForExecution } from "../action-plans/actions"

export async function submitExecution(executionId: string) {
  const ctx = await getContext()

  // 0) valida execução do tenant e status atual
  const execRes = await sql<{ workflow_status: string }>`
    SELECT workflow_status::text AS workflow_status
    FROM kpi_executions
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${executionId}
    LIMIT 1
  `
  const current = execRes.rows[0]?.workflow_status
  if (!current) throw new Error("Execução não encontrada ou fora do tenant.")

  // evita resubmeter estados finais
  const s = (current || "").toLowerCase()
  if (s === "approved" || s === "rejected") {
    throw new Error(`Execução já está em estado final (${current}).`)
  }

  // 1) valida evidência obrigatória (se KPI exigir)
  const reqRes = await sql<{ evidence_required: boolean | null }>`
    SELECT k.evidence_required
    FROM kpi_executions e
    JOIN kpis k ON k.id = e.kpi_id
    WHERE e.tenant_id = ${ctx.tenantId}
      AND e.id = ${executionId}
    LIMIT 1
  `
  const evidenceRequired = !!reqRes.rows[0]?.evidence_required

  if (evidenceRequired) {
    const evRes = await sql<{ cnt: number }>`
      SELECT COUNT(*)::int AS cnt
      FROM evidences
      WHERE tenant_id = ${ctx.tenantId}
        AND execution_id = ${executionId}
    `
    const cnt = evRes.rows[0]?.cnt ?? 0
    if (cnt < 1) {
      throw new Error("Este KPI exige evidência. Adicione pelo menos 1 evidência antes de submeter.")
    }
  }

  // 2) recalcula auto_status antes de enviar
  await recomputeExecutionAutoStatus(executionId)

  // 3) envia para revisão
  await sql`
    UPDATE kpi_executions
    SET
      workflow_status = 'submitted',
      submitted_at = NOW(),
      review_due_date = NOW() + interval '5 days'
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${executionId}
  `

  // 4) cria action plan (só cria se warning/out_of_target ou gatilho grc_review)
  await ensureActionPlanForExecution({
    executionId,
    trigger: "auto_status",
    reason:
      "Execução submetida com resultado fora/na faixa de atenção (auto_status warning/out_of_target).",
    dueInDays: 14,
  })

  revalidatePath("/execucoes")
  revalidatePath("/revisoes")
  revalidatePath("/dashboard")
  revalidatePath(`/execucoes/${executionId}`)
}
