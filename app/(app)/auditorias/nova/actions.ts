// app/(app)/auditorias/nova/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../../lib/context"
import { ensureAuditCampaignsTables, ensureTeamIdColumns } from "../../lib/rbac-migrations"

export type ControlPickRow = {
  control_id: string
  control_code: string
  control_name: string
  domain: string | null
  frequency: string | null
  risk_level: string | null
}

export type EvidenceItemInput = {
  title: string
  instructions?: string | null
  kind: "document" | "screenshot" | "link" | "spreadsheet" | "any"
  controlId?: string | null
  requesterTeamId?: string | null
  samplingInfo?: string | null
  deliveryDeadline?: string | null // yyyy-mm-dd
}

export type CreateAuditCampaignInput = {
  name: string
  framework: string
  periodStart: string // yyyy-mm-dd
  periodEnd: string // yyyy-mm-dd
  objective: string | null
  controlIds: string[]
  evidences: EvidenceItemInput[]
}

export type CreateAuditCampaignContext = {
  frameworks: Array<{ value: string; label: string }>
  requesterTeams: Array<{ value: string; label: string }>
  areaOptions: Array<{ value: string; label: string }>
  frequencyOptions: Array<{ value: string; label: string }>
  controls: ControlPickRow[]
}

export async function fetchAuditCampaignCreateContext(): Promise<CreateAuditCampaignContext> {
  const ctx = await getContext()
  await ensureTeamIdColumns()

  // frameworks da tabela frameworks (coluna name)
  const frameworksRes = await sql<{ id: string; name: string }>`
    SELECT id::text AS id, name::text AS name
    FROM frameworks
    WHERE tenant_id = ${ctx.tenantId}::uuid
    ORDER BY name ASC
  `
  const frameworks = frameworksRes.rows.map((r) => ({ value: r.name, label: r.name }))
  const teamsRes = await sql<{ id: string; name: string }>`
    SELECT id::text AS id, name::text AS name
    FROM teams
    WHERE tenant_id = ${ctx.tenantId}::uuid
    ORDER BY name ASC
  `
  const requesterTeams = teamsRes.rows.map((r) => ({ value: r.id, label: r.name }))

  // controls list (pra seleção)
  const controlsRes = await sql<{
    control_id: string
    control_code: string
    control_name: string
    domain: string | null
    frequency: string | null
    risk_level: string | null
  }>`
    SELECT
      c.id::text AS control_id,
      c.control_code,
      c.name AS control_name,
      COALESCE(NULLIF(btrim(COALESCE(c.area, '')), ''), '(Sem área)')::text AS domain,
      COALESCE(NULLIF(btrim(c.frequency::text), ''), '(Sem frequência)')::text AS frequency,
      CASE
        WHEN r.classification IS NULL THEN NULL
        WHEN lower(trim(r.classification::text)) IN ('medium', 'med', 'moderate', 'médio', 'medio') THEN 'medium'
        WHEN lower(trim(r.classification::text)) IN ('critical', 'crítico', 'critico') THEN 'critical'
        WHEN lower(trim(r.classification::text)) IN ('high', 'alto') THEN 'high'
        WHEN lower(trim(r.classification::text)) IN ('low', 'baixo') THEN 'low'
        ELSE lower(trim(r.classification::text))
      END AS risk_level
    FROM controls c
    LEFT JOIN risk_catalog r ON r.id = c.risk_id
    WHERE c.tenant_id = ${ctx.tenantId}
    ORDER BY c.control_code ASC
    LIMIT 500;
  `

  const controls: ControlPickRow[] = controlsRes.rows.map((r) => ({
    control_id: r.control_id,
    control_code: r.control_code,
    control_name: r.control_name,
    domain: r.domain,
    frequency: r.frequency,
    risk_level: r.risk_level,
  }))

  // áreas distintas (domain/area)
  const areaSet = new Map<string, string>()
  for (const c of controls) {
    const v = (c.domain || "").trim()
    if (!v || v === "(Sem área)") continue
    if (!areaSet.has(v)) areaSet.set(v, v)
  }
  const areaOptions = [{ value: "all", label: "Todos" }]
  for (const [v, l] of areaSet) areaOptions.push({ value: v, label: l })
  areaOptions.push({ value: "__sem__", label: "(Sem área)" })

  // frequências distintas
  const freqSet = new Map<string, string>()
  for (const c of controls) {
    const v = (c.frequency || "").trim()
    if (!v || v === "(Sem frequência)") continue
    if (!freqSet.has(v)) freqSet.set(v, v)
  }
  const frequencyOptions = [{ value: "all", label: "Todos" }]
  for (const [v, l] of freqSet) frequencyOptions.push({ value: v, label: l })
  frequencyOptions.push({ value: "__sem__", label: "(Sem frequência)" })

  return { frameworks, requesterTeams, areaOptions, frequencyOptions, controls }
}

export async function createAuditCampaign(input: CreateAuditCampaignInput): Promise<{ campaignId: string }> {
  const ctx = await getContext()
  await ensureAuditCampaignsTables()

  const name = (input.name || "").trim()
  if (name.length < 3) throw new Error("Nome da campanha inválido.")
  if (!input.framework) throw new Error("Selecione um framework.")
  if (!input.periodStart || !input.periodEnd) throw new Error("Selecione o período (início e término).")
  if (!Array.isArray(input.controlIds) || input.controlIds.length === 0) {
    throw new Error("Selecione ao menos 1 controle.")
  }

  // 1) cria campanha
  const created = await sql<{ id: string }>`
    INSERT INTO audit_campaigns (
      tenant_id,
      name,
      framework,
      period_start,
      period_end,
      objective,
      status
    )
    VALUES (
      ${ctx.tenantId},
      ${name},
      ${input.framework},
      ${input.periodStart}::date,
      ${input.periodEnd}::date,
      ${input.objective},
      'active'
    )
    RETURNING id::text AS id;
  `
  const campaignId = created.rows?.[0]?.id
  if (!campaignId) throw new Error("Falha ao criar campanha.")

  // 2) vincula controles
  const valuesControls = input.controlIds.map((id) => `(${ctx.tenantId}::uuid, ${campaignId}::uuid, ${id}::uuid)`)
  // ⚠️ usamos SQL direto via string? melhor fazer insert em loop para evitar risco
  for (const controlId of input.controlIds) {
    await sql`
      INSERT INTO audit_campaign_controls (tenant_id, campaign_id, control_id)
      VALUES (${ctx.tenantId}, ${campaignId}::uuid, ${controlId}::uuid)
      ON CONFLICT DO NOTHING;
    `
  }

  // 3) request list (itens) - audit_request_items
  const kindToType: Record<string, string> = {
    document: "pdf",
    screenshot: "screenshot",
    link: "link",
    spreadsheet: "sheet",
    any: "any",
  }
  let pos = 1
  for (const ev of input.evidences || []) {
    const title = (ev.title || "").trim()
    if (!title) continue

    const itemType = kindToType[ev.kind] ?? "any"
    const controlId = ev.controlId?.trim() || null
    const requesterTeamId = ev.requesterTeamId?.trim() || null
    const deliveryDeadline = ev.deliveryDeadline?.trim() || null
    await sql`
      INSERT INTO audit_request_items (
        tenant_id,
        campaign_id,
        control_id,
        requester_team_id,
        title,
        instructions,
        item_type,
        sampling_info,
        delivery_deadline,
        position
      )
      VALUES (
        ${ctx.tenantId},
        ${campaignId}::uuid,
        ${controlId},
        ${requesterTeamId}::uuid,
        ${title},
        ${ev.instructions ?? null},
        ${itemType},
        ${ev.samplingInfo ?? null},
        ${deliveryDeadline},
        ${pos}
      )
    `
    pos++
  }

  return { campaignId }
}
