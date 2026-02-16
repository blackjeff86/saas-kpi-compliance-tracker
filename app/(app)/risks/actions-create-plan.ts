"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"
import { revalidatePath } from "next/cache"

export async function ensureActionPlanForRisk(riskId: string) {
  const ctx = await getContext()

  const { rows } = await sql<{
    id: string
    title: string
    classification: string
  }>`
    SELECT id, title, classification::text AS classification
    FROM risks
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${riskId}
    LIMIT 1
  `

  const risk = rows[0]
  if (!risk) throw new Error("Risco não encontrado.")

  const classification = (risk.classification || "").toLowerCase()
  if (classification !== "high" && classification !== "critical") {
    return { created: false as const, reason: "not_required" as const }
  }

  // não duplica: se já existe plano aberto para o risco
  const existing = await sql`
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

  const priority = classification === "critical" ? "critical" : "high"
  const dueInDays = classification === "critical" ? 14 : 30

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
      ${`Plano de ação • Risco: ${risk.title}`},
      ${`Plano criado automaticamente para risco ${classification}. Owner será definido pelo GRC.`},
      ${null},
      (CURRENT_DATE + (${dueInDays} || ' days')::interval)::date,
      ${priority},
      'not_started',
      NOW(),
      NOW()
    )
  `

  revalidatePath("/action-plans")
  revalidatePath("/dashboard")

  return { created: true as const }
}
