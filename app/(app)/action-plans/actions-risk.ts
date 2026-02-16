"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../lib/context"

const DEFAULT_PRIORITY = "medium" as const

// Cria (se necessário) um action plan para o risco quando classification = high/critical
// Regra A: nunca fecha automaticamente se o risco baixar depois.
export async function ensureActionPlanForRisk(riskId: string, opts?: { dueInDays?: number }) {
  const ctx = await getContext()
  const dueDays = opts?.dueInDays ?? 14

  // 1) Carrega contexto do risco
  const { rows } = await sql<{
    risk_id: string
    title: string
    classification: string
    domain: string
    status: string
    impact: number
    likelihood: number
    risk_score: number
  }>`
    SELECT
      r.id AS risk_id,
      r.title,
      r.classification::text AS classification,
      r.domain,
      r.status::text AS status,
      r.impact,
      r.likelihood,
      r.risk_score
    FROM risks r
    WHERE r.tenant_id = ${ctx.tenantId}
      AND r.id = ${riskId}
    LIMIT 1
  `
  const r = rows[0]
  if (!r) throw new Error("Risco não encontrado (tenant).")

  // 2) Regra: só cria plano se high/critical
  const cls = (r.classification || "").toLowerCase()
  const shouldCreate = cls === "high" || cls === "critical"
  if (!shouldCreate) {
    return { created: false as const, reason: "classification_ok" as const }
  }

  // 3) Não duplica: se já existe plano NÃO finalizado (status != done), não cria outro
  const existing = await sql<{ id: string }>`
    SELECT id
    FROM action_plans
    WHERE tenant_id = ${ctx.tenantId}
      AND risk_id = ${riskId}
      AND status::text <> 'done'
    LIMIT 1
  `
  if (existing.rows[0]?.id) {
    return { created: false as const, reason: "already_open" as const }
  }

  // 4) Prioridade automática (critical => critical, high => high)
  const priority = cls === "critical" ? ("critical" as const) : ("high" as const)

  const title = `Plano de ação • Risco • ${r.title}`
  const description =
    `Plano gerado automaticamente a partir de risco classificado como ${r.classification}.\n\n` +
    `Risco: ${r.title}\n` +
    `Domínio: ${r.domain}\n` +
    `Status do risco: ${r.status}\n` +
    `Impacto: ${r.impact}\n` +
    `Probabilidade: ${r.likelihood}\n` +
    `Score: ${r.risk_score}\n`

  // 5) Cria action plan (note o risk_id preenchido)
  await sql`
    INSERT INTO action_plans (
      tenant_id,
      risk_id,
      title,
      description,
      owner_user_id,
      due_date,
      priority,
      status,
      created_at,
      updated_at
    )
    VALUES (
      ${ctx.tenantId},
      ${riskId},
      ${title},
      ${description},
      ${null},
      (CURRENT_DATE + (${dueDays} * INTERVAL '1 day'))::date,
      ${priority}::action_priority,
      'not_started'::action_status,
      NOW(),
      NOW()
    )
  `

  // Revalida páginas relevantes
  revalidatePath(`/risks/${riskId}`)
  revalidatePath("/risks")
  revalidatePath("/dashboard")
  revalidatePath("/action-plans")

  return { created: true as const }
}
