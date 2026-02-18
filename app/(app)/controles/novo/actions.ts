// app/(app)/controles/novo/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../../lib/context"

export type FrameworkOption = { name: string }
export type UserOption = { name: string; email: string }

export async function fetchFrameworkOptions(): Promise<FrameworkOption[]> {
  const ctx = await getContext()

  const r = await sql<{ name: string }>`
    SELECT name
    FROM frameworks
    WHERE tenant_id = ${ctx.tenantId}::uuid
    ORDER BY name ASC
  `
  return r.rows.map((x) => ({ name: x.name }))
}

export async function fetchUserOptions(): Promise<UserOption[]> {
  const ctx = await getContext()

  const r = await sql<{ name: string; email: string }>`
    SELECT name, email
    FROM users
    WHERE tenant_id = ${ctx.tenantId}::uuid
    ORDER BY name ASC
  `
  return r.rows
}

export async function checkControlCodeAvailability(controlCode: string) {
  const ctx = await getContext()
  const code = String(controlCode || "").trim()
  if (!code) return { ok: true as const, available: true as const }

  const r = await sql<{ id: string }>`
    SELECT id
    FROM controls
    WHERE tenant_id = ${ctx.tenantId}::uuid
      AND control_code = ${code}
    LIMIT 1
  `
  return { ok: true as const, available: r.rowCount === 0 }
}

type KPIInput = {
  kpi_code: string
  kpi_name: string
  kpi_description: string
  kpi_type: string
  kpi_target_operator: string
  kpi_target_value: number | null
  kpi_target_boolean: boolean | null
  kpi_warning_buffer_pct: number
}

export type CreateControlInput = {
  framework: string
  control_code: string
  control_name: string
  control_description: string
  control_goal: string
  control_status: string
  control_frequency: string
  control_type: string

  control_owner_email: string
  control_owner_name: string
  focal_point_email: string
  focal_point_name: string

  risk_code: string
  risk_name: string
  risk_description: string
  risk_classification: string
  impact: number
  likelihood: number

  kpis: KPIInput[]
}

export async function createControlWithKpis(input: CreateControlInput): Promise<
  | { ok: true; control_id: string }
  | { ok: false; error: string }
> {
  const ctx = await getContext()

  const framework = String(input.framework || "").trim()
  const control_code = String(input.control_code || "").trim()
  const control_name = String(input.control_name || "").trim()

  if (!framework) return { ok: false, error: "Framework é obrigatório." }
  if (!control_code) return { ok: false, error: "Código do controle (control_code) é obrigatório." }
  if (!control_name) return { ok: false, error: "Nome do controle (control_name) é obrigatório." }
  if (!String(input.control_owner_email || "").trim() || !String(input.control_owner_name || "").trim()) {
    return { ok: false, error: "Control Owner (nome e email) é obrigatório." }
  }

  // 1) garantir framework
  await sql`
    INSERT INTO frameworks (tenant_id, name)
    VALUES (${ctx.tenantId}::uuid, ${framework})
    ON CONFLICT (tenant_id, name) DO NOTHING
  `

  // 2) risco (opcional)
  let riskId: string | null = null
  const risk_code = String(input.risk_code || "").trim()
  if (risk_code) {
    const risk_name = String(input.risk_name || "").trim()
    const risk_description = String(input.risk_description || "").trim()
    const risk_classification = String(input.risk_classification || "").trim() || "med"

    const risk = await sql<{ id: string }>`
      INSERT INTO risk_catalog (tenant_id, risk_code, title, description, impact, likelihood, risk_classification)
      VALUES (
        ${ctx.tenantId}::uuid,
        ${risk_code},
        ${risk_name || risk_code},
        ${risk_description},
        ${Number(input.impact || 3)},
        ${Number(input.likelihood || 3)},
        ${risk_classification}
      )
      ON CONFLICT (tenant_id, risk_code) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        impact = EXCLUDED.impact,
        likelihood = EXCLUDED.likelihood,
        risk_classification = EXCLUDED.risk_classification
      RETURNING id
    `
    riskId = risk.rows[0]?.id ?? null
  }

  // 3) não sobrescrever controle existente
  const exists = await sql<{ id: string }>`
    SELECT id
    FROM controls
    WHERE tenant_id = ${ctx.tenantId}::uuid
      AND control_code = ${control_code}
    LIMIT 1
  `
  if (exists.rowCount) {
    return { ok: false, error: `Já existe um controle com code "${control_code}" neste tenant.` }
  }

  // 4) criar controle
  const control = await sql<{ id: string }>`
    INSERT INTO controls (
      tenant_id, framework, control_code, name, description, goal, status, frequency, control_type,
      control_owner_email, control_owner_name, focal_point_email, focal_point_name,
      risk_id, mes_ref
    )
    VALUES (
      ${ctx.tenantId}::uuid,
      ${framework},
      ${control_code},
      ${control_name},
      ${String(input.control_description || "").trim()},
      ${String(input.control_goal || "").trim()},
      ${String(input.control_status || "active").trim()},
      ${String(input.control_frequency || "monthly").trim()},
      ${String(input.control_type || "detective").trim()},
      ${String(input.control_owner_email || "").trim()},
      ${String(input.control_owner_name || "").trim()},
      ${String(input.focal_point_email || "").trim()},
      ${String(input.focal_point_name || "").trim()},
      ${riskId ? (riskId as any) : null},
      NULL
    )
    RETURNING id
  `
  const control_id = control.rows[0].id

  // audit: controle criado
  await sql`
    INSERT INTO audit_events (tenant_id, entity_type, entity_id, action, actor, summary, metadata)
    VALUES (
      ${ctx.tenantId}::uuid,
      'control',
      ${control_id}::uuid,
      'created',
      ${ctx.userEmail || "system"},
      ${`Controle criado: ${control_code}`},
      ${JSON.stringify({ control_code, framework })}::jsonb
    )
  `

  // 5) criar KPIs (opcional)
  for (const k of input.kpis || []) {
    const kpi_code = String(k.kpi_code || "").trim()
    const kpi_name = String(k.kpi_name || "").trim()
    if (!kpi_code || !kpi_name) continue

    await sql`
      INSERT INTO kpis (
        tenant_id, control_id, kpi_code, name, description,
        kpi_type, target_operator, target_value, target_boolean, warning_buffer_pct
      )
      VALUES (
        ${ctx.tenantId}::uuid,
        ${control_id}::uuid,
        ${kpi_code},
        ${kpi_name},
        ${String(k.kpi_description || "").trim()},
        ${String(k.kpi_type || "numeric").trim()},
        ${String(k.kpi_target_operator || ">=").trim()},
        ${k.kpi_target_value},
        ${k.kpi_target_boolean},
        ${Number(k.kpi_warning_buffer_pct || 0)}
      )
      ON CONFLICT (tenant_id, kpi_code) DO UPDATE SET
        control_id = EXCLUDED.control_id,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        kpi_type = EXCLUDED.kpi_type,
        target_operator = EXCLUDED.target_operator,
        target_value = EXCLUDED.target_value,
        target_boolean = EXCLUDED.target_boolean,
        warning_buffer_pct = EXCLUDED.warning_buffer_pct,
        updated_at = now()
    `

    await sql`
      INSERT INTO audit_events (tenant_id, entity_type, entity_id, action, actor, summary, metadata)
      VALUES (
        ${ctx.tenantId}::uuid,
        'kpi',
        ${control_id}::uuid,
        'created',
        ${ctx.userEmail || "system"},
        ${`KPI vinculado ao controle: ${kpi_code}`},
        ${JSON.stringify({ kpi_code, control_code })}::jsonb
      )
    `
  }

  revalidatePath("/controles")
  revalidatePath(`/controles/${control_id}`)

  return { ok: true, control_id }
}
