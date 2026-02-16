"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../lib/context"

const DEFAULT_PRIORITY = "medium" as const

type Trigger = "auto_status" | "grc_review"

export async function ensureActionPlanForExecution(opts: {
  executionId: string
  trigger: Trigger
  reason: string
  dueInDays?: number
}) {
  const ctx = await getContext()
  const dueDays = opts.dueInDays ?? 14

  // 1) carrega contexto da execução
  const { rows } = await sql<{
    execution_id: string
    control_id: string
    kpi_id: string
    control_code: string
    control_name: string
    kpi_code: string
    kpi_name: string
    auto_status: string
    workflow_status: string
  }>`
    SELECT
      e.id AS execution_id,
      e.control_id,
      e.kpi_id,
      c.control_code,
      c.name AS control_name,
      k.kpi_code,
      k.name AS kpi_name,
      e.auto_status::text AS auto_status,
      e.workflow_status::text AS workflow_status
    FROM kpi_executions e
    JOIN controls c ON c.id = e.control_id
    JOIN kpis k ON k.id = e.kpi_id
    WHERE e.tenant_id = ${ctx.tenantId}
      AND e.id = ${opts.executionId}
    LIMIT 1
  `
  const x = rows[0]
  if (!x) throw new Error("Execução não encontrada (tenant).")

  // 2) regra: quando criar plano?
  const a = (x.auto_status || "").toLowerCase()
  const shouldCreate =
    opts.trigger === "grc_review" ||
    a === "out_of_target" ||
    a === "warning"

  if (!shouldCreate) {
    return { created: false as const, reason: "auto_status_ok" as const }
  }

  // 3) não duplica: se já existe plano NÃO finalizado (status != done), não cria outro
  const existing = await sql<{ id: string }>`
    SELECT id
    FROM action_plans
    WHERE tenant_id = ${ctx.tenantId}
      AND execution_id = ${opts.executionId}
      AND status::text <> 'done'
    LIMIT 1
  `
  if (existing.rows[0]?.id) {
    return { created: false as const, reason: "already_open" as const }
  }

  // 4) prioridade automática
  const priority = a === "out_of_target" ? ("high" as const) : DEFAULT_PRIORITY

  const title = `Plano de ação • ${x.control_code} • ${x.kpi_code}`
  const description =
    `${opts.reason}\n\n` +
    `Controle: ${x.control_code} — ${x.control_name}\n` +
    `KPI: ${x.kpi_code} — ${x.kpi_name}\n` +
    `Trigger: ${opts.trigger}\n` +
    `auto_status: ${x.auto_status}\n` +
    `workflow_status: ${x.workflow_status}`

  // 5) cria plano
  await sql`
    INSERT INTO action_plans (
      tenant_id,
      execution_id,
      control_id,
      kpi_id,
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
      ${x.execution_id},
      ${x.control_id},
      ${x.kpi_id},
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

  revalidatePath(`/execucoes/${opts.executionId}`)
  revalidatePath("/execucoes")
  revalidatePath("/revisoes")
  revalidatePath("/dashboard")
  revalidatePath("/action-plans")

  return { created: true as const }
}
