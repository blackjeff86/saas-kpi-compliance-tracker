"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../../lib/context"

export type ActionPlanUpdateRow = {
  id: string
  content: string
  created_at: string
  author_name: string | null
}

async function ensureActionPlanUpdatesTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS action_plan_updates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      action_plan_id uuid NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
      content text NOT NULL,
      created_by uuid NULL,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `
}

let _actionPlanEventsTableEnsured = false
async function ensureActionPlanEventsTable() {
  if (_actionPlanEventsTableEnsured) return
  await sql`
    CREATE TABLE IF NOT EXISTS action_plan_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      action_plan_id uuid NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
      event_type text NOT NULL,
      task_title text NULL,
      metadata jsonb NULL,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_action_plan_events_tenant_plan_created
      ON action_plan_events(tenant_id, action_plan_id, created_at DESC)
  `
  _actionPlanEventsTableEnsured = true
}

export async function fetchActionPlanUpdates(actionPlanId: string): Promise<ActionPlanUpdateRow[]> {
  const ctx = await getContext()
  await ensureActionPlanUpdatesTable()

  const { rows } = await sql<{ id: string; content: string; created_at: string; author_name: string | null }>`
    SELECT
      u.id::text AS id,
      u.content::text AS content,
      u.created_at::text AS created_at,
      us.name::text AS author_name
    FROM action_plan_updates u
    LEFT JOIN users us
      ON us.id = u.created_by
     AND us.tenant_id = u.tenant_id
    WHERE u.tenant_id = ${ctx.tenantId}::uuid
      AND u.action_plan_id = ${actionPlanId}::uuid
    ORDER BY u.created_at DESC
    LIMIT 50
  `

  return rows ?? []
}

export async function addActionPlanUpdate(
  actionPlanId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext()
  await ensureActionPlanUpdatesTable()
  await ensureActionPlanEventsTable()

  const content = String(formData.get("content") ?? "").trim()
  if (!content) return { ok: false, error: "A descrição da atualização é obrigatória." }

  try {
    const exists = await sql<{ id: string }>`
      SELECT ap.id
      FROM action_plans ap
      WHERE ap.tenant_id = ${ctx.tenantId}::uuid
        AND ap.id = ${actionPlanId}::uuid
      LIMIT 1
    `
    if (!exists.rows[0]?.id) return { ok: false, error: "Plano não encontrado." }

    await sql`
      INSERT INTO action_plan_updates (tenant_id, action_plan_id, content, created_by, created_at)
      VALUES (
        ${ctx.tenantId}::uuid,
        ${actionPlanId}::uuid,
        ${content},
        ${ctx.userId}::uuid,
        NOW()
      )
    `
    await sql`
      INSERT INTO action_plan_events (
        tenant_id,
        action_plan_id,
        event_type,
        task_title,
        metadata,
        created_at
      )
      VALUES (
        ${ctx.tenantId}::uuid,
        ${actionPlanId}::uuid,
        'update_added',
        null,
        ${JSON.stringify({
          message: `${content.slice(0, 160)}${content.length > 160 ? "..." : ""}`,
        })}::jsonb,
        NOW()
      )
    `

    revalidatePath(`/action-plans/${actionPlanId}`)
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
