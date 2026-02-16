"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../lib/context"
import { ensureActionPlanForRisk } from "../action-plans/actions-risk"

type RiskClassification = "low" | "med" | "high" | "critical"

function clamp1to5(n: number) {
  const v = Number.isFinite(n) ? n : 1
  return Math.max(1, Math.min(5, Math.trunc(v)))
}

function classificationFromScore(score: number): RiskClassification {
  if (score <= 5) return "low"
  if (score <= 10) return "med"
  if (score <= 15) return "high"
  return "critical"
}

export async function addRiskAssessment(input: {
  riskId: string
  impact: number
  likelihood: number
  notes?: string
}) {
  const ctx = await getContext()

  const impact = clamp1to5(input.impact)
  const likelihood = clamp1to5(input.likelihood)
  const score = impact * likelihood
  const classification = classificationFromScore(score)

  const exists = await sql<{ id: string }>`
    SELECT id
    FROM risks
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${input.riskId}
    LIMIT 1
  `
  if (!exists.rows[0]?.id) throw new Error("Risco não encontrado.")

  await sql`
    INSERT INTO risk_assessments (
      tenant_id, risk_id,
      likelihood, impact, score,
      classification, notes,
      assessed_by, assessed_at,
      created_at
    )
    VALUES (
      ${ctx.tenantId}, ${input.riskId},
      ${likelihood}, ${impact}, ${score},
      ${classification}::risk_classification, ${input.notes ?? null},
      ${ctx.userId ?? null}, NOW(),
      NOW()
    )
  `

  await sql`
    UPDATE risks
    SET
      likelihood = ${likelihood},
      impact = ${impact},
      risk_score = ${score},
      classification = ${classification}::risk_classification,
      updated_at = NOW()
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${input.riskId}
  `

  // Regra A: cria plano se high/critical; NÃO fecha automaticamente se baixar depois
  await ensureActionPlanForRisk(input.riskId)

  revalidatePath(`/risks/${input.riskId}`)
  revalidatePath("/risks")
  revalidatePath("/action-plans")
  revalidatePath("/dashboard")

  return { ok: true as const, score, classification }
}
