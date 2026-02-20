"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"
import { revalidatePath } from "next/cache"

export async function ensureActionPlanForRisk(
  riskId: string,
  opts?: { responsibleName?: string | null }
) {
  const ctx = await getContext()
  const responsibleName = opts?.responsibleName?.trim() || null
  let ownerUserId: string | null = null

  if (responsibleName) {
    const byEmail = await sql<{ id: string }>`
      SELECT id::text AS id
      FROM users
      WHERE tenant_id = ${ctx.tenantId}
        AND lower(email::text) = lower(${responsibleName})
      LIMIT 1
    `
    if (byEmail.rows?.[0]?.id) {
      ownerUserId = byEmail.rows[0].id
    } else {
      const byName = await sql<{ id: string }>`
        SELECT id::text AS id
        FROM users
        WHERE tenant_id = ${ctx.tenantId}
          AND lower(name::text) = lower(${responsibleName})
        ORDER BY created_at DESC
        LIMIT 2
      `
      if (byName.rows.length === 1) {
        ownerUserId = byName.rows[0].id
      }
    }
  }

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
      responsible_name,
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
      ${responsibleName},
      ${ownerUserId ? ownerUserId : null}::uuid,
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
