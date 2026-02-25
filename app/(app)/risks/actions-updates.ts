"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../lib/context"

export type RiskUpdateRow = {
  id: string
  content: string
  created_at: string
  author_name: string | null
}

async function ensureRiskUpdatesTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS risk_updates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      risk_id uuid NOT NULL,
      content text NOT NULL,
      created_by uuid NULL,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `
}

export async function fetchRiskUpdates(riskId: string): Promise<RiskUpdateRow[]> {
  const ctx = await getContext()
  await ensureRiskUpdatesTable()

  const { rows } = await sql<{ id: string; content: string; created_at: string; author_name: string | null }>`
    SELECT
      u.id::text AS id,
      u.content::text AS content,
      u.created_at::text AS created_at,
      us.name::text AS author_name
    FROM risk_updates u
    LEFT JOIN users us ON us.id = u.created_by AND us.tenant_id = u.tenant_id
    WHERE u.tenant_id = ${ctx.tenantId}::uuid
      AND u.risk_id = ${riskId}::uuid
    ORDER BY u.created_at DESC
    LIMIT 50
  `

  return rows ?? []
}

export async function addRiskUpdate(riskId: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext()
  await ensureRiskUpdatesTable()

  const content = String(formData.get("content") ?? "").trim()
  if (!content) return { ok: false, error: "A descrição da atualização é obrigatória." }

  try {
    await sql`
      INSERT INTO risk_updates (tenant_id, risk_id, content, created_by, created_at)
      VALUES (
        ${ctx.tenantId}::uuid,
        ${riskId}::uuid,
        ${content},
        ${ctx.userId}::uuid,
        now()
      )
    `

    await sql`
      INSERT INTO audit_events (tenant_id, entity_type, entity_id, action, actor_user_id, metadata, created_at)
      VALUES (
        ${ctx.tenantId}::uuid,
        'risk',
        ${riskId}::uuid,
        'risk_update_added',
        ${ctx.userId}::uuid,
        ${JSON.stringify({ summary: content.slice(0, 100) + (content.length > 100 ? "…" : "") })}::jsonb,
        now()
      )
    `

    revalidatePath(`/risks/${riskId}`)
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
