// app/(app)/auditorias/[id]/acompanhamento/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../../../lib/context"
import { ensureAuditCampaignsTables } from "../../../lib/rbac-migrations"

export type AuditRequestItemInput = {
  title: string
  instructions?: string | null
  kind: "document" | "screenshot" | "link" | "spreadsheet" | "any"
  controlId?: string | null
  requesterTeamId?: string | null
  samplingInfo?: string | null
  deliveryDeadline?: string | null
}

export type AuditCampaignFollowUpData = {
  campaign: {
    id: string
    name: string
    status: "draft" | "active" | "closed"
    due_date: string | null
  }
  kpis: {
    progress_pct: number
    days_left: number | null
    pending_controls_total: number
    pending_evidences_total: number
    pending_evidences_new_today: number
    pending_by_dept: Array<{ dept: string; count: number }>
  }
  dept_progress: Array<{
    dept: string
    label: string
    icon: string
    pct: number
  }>
  controls: Array<{
    control_id: string
    control_code: string
    control_name: string
    owner_name: string | null
    owner_avatar_url: string | null
    phase: "evidence" | "review_text" | "final_approval" | "other"
    deadline: string | null
  }>
  requester_teams: Array<{
    id: string
    name: string
  }>
  request_items: Array<{
    id: string
    title: string
    instructions: string | null
    item_type: string
    control_id: string | null
    control_code: string | null
    control_name: string | null
    requester_team_id: string | null
    requester_team_name: string | null
    sampling_info: string | null
    delivery_deadline: string | null
    position: number
  }>
}

export async function fetchAuditCampaignFollowUp(input: {
  campaignId: string
}): Promise<AuditCampaignFollowUpData> {
  const ctx = await getContext()
  await ensureAuditCampaignsTables()
  const campaignId = (input?.campaignId || "").trim()
  if (!ctx?.tenantId) throw new Error("Contexto inválido (tenant).")
  if (!campaignId) throw new Error("CampaignId inválido.")

  // 1) campanha (audit_campaigns)
  const camp = await sql<{
    id: string
    name: string
    status: string
    period_end: string | null
  }>`
    SELECT
      id::text AS id,
      name,
      status::text AS status,
      period_end::text AS period_end
    FROM audit_campaigns
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${campaignId}::uuid
    LIMIT 1;
  `

  if (!camp.rows?.[0]) {
    return mockFollowUp(campaignId)
  }

  const c = camp.rows[0]
  const status = (c.status as any) as "draft" | "active" | "closed"
  const due = c.period_end

  // 2) controles no escopo
  const controlsRes = await sql<{
    control_id: string
    control_code: string
    control_name: string
    owner_name: string | null
    owner_avatar_url: string | null
  }>`
    SELECT
      co.id::text AS control_id,
      co.control_code,
      co.name AS control_name,
      co.control_owner_name AS owner_name,
      NULL::text AS owner_avatar_url
    FROM audit_campaign_controls acc
    JOIN controls co ON co.id = acc.control_id
    WHERE acc.tenant_id = ${ctx.tenantId}
      AND acc.campaign_id = ${campaignId}::uuid
    ORDER BY co.control_code ASC
    LIMIT 500;
  `

  // 3) evidências pendentes (tabela evidences) — adapta o filtro conforme seu schema
  let pendingEvidencesTotal = 0
  let pendingEvidencesNewToday = 0

  try {
    const ev = await sql<{ pending_total: number; new_today: number }>`
      SELECT
        count(*)::int AS pending_total,
        count(*) FILTER (WHERE created_at::date = now()::date)::int AS new_today
      FROM evidences
      WHERE tenant_id = ${ctx.tenantId}
        AND (status IS NULL OR status::text NOT IN ('approved'));
    `
    pendingEvidencesTotal = ev.rows?.[0]?.pending_total ?? 0
    pendingEvidencesNewToday = ev.rows?.[0]?.new_today ?? 0
  } catch {
    // deixa 0
  }

  // 4) progress / pending controls — placeholder
  const totalControls = controlsRes.rows.length
  const pendingControlsTotal = Math.max(0, totalControls) // troque pela regra real quando tiver status/fase por controle
  const progressPct =
    totalControls === 0
      ? 0
      : Math.max(0, Math.min(100, Math.round(((totalControls - pendingControlsTotal) / totalControls) * 100)))

  // days_left
  let daysLeft: number | null = null
  if (due) {
    try {
      const r = await sql<{ days_left: number }>`
        SELECT GREATEST(0, ((${due}::date - now()::date)))::int AS days_left;
      `
      daysLeft = r.rows?.[0]?.days_left ?? null
    } catch {
      daysLeft = null
    }
  }

  // pending_by_dept / dept_progress — placeholder (sem dept real)
  const pendingByDept = [
    { dept: "TI", count: Math.min(10, pendingControlsTotal) },
    { dept: "RH", count: Math.min(6, pendingControlsTotal) },
    { dept: "FIN", count: Math.min(8, pendingControlsTotal) },
    { dept: "JUR", count: Math.min(12, pendingControlsTotal) },
  ]

  const deptProgress = [
    { dept: "ti", label: "T.I.", icon: "💻", pct: 85 },
    { dept: "rh", label: "R.H.", icon: "👥", pct: 42 },
    { dept: "fin", label: "Financeiro", icon: "💳", pct: 60 },
    { dept: "jur", label: "Jurídico", icon: "⚖️", pct: 25 },
  ]

  const controls = controlsRes.rows.map((r, idx) => ({
    control_id: r.control_id,
    control_code: r.control_code,
    control_name: r.control_name,
    owner_name: r.owner_name,
    owner_avatar_url: r.owner_avatar_url,
    phase: (idx % 3 === 0 ? "evidence" : idx % 3 === 1 ? "review_text" : "final_approval") as
      | "evidence"
      | "review_text"
      | "final_approval"
      | "other",
    deadline: due,
  }))

  const requesterTeamsRes = await sql<{ id: string; name: string }>`
    SELECT id::text AS id, name::text AS name
    FROM teams
    WHERE tenant_id = ${ctx.tenantId}::uuid
    ORDER BY name ASC
  `

  // 5) request list (audit_request_items)
  let requestItems: AuditCampaignFollowUpData["request_items"] = []
  try {
    const itemsRes = await sql<{
      id: string
      title: string
      instructions: string | null
      item_type: string
      control_id: string | null
      control_code: string | null
      control_name: string | null
      requester_team_id: string | null
      requester_team_name: string | null
      sampling_info: string | null
      delivery_deadline: string | null
      position: number
    }>`
      SELECT
        a.id::text AS id,
        a.title,
        a.instructions,
        a.item_type,
        a.control_id::text AS control_id,
        c.control_code AS control_code,
        c.name AS control_name,
        a.requester_team_id::text AS requester_team_id,
        t.name::text AS requester_team_name,
        a.sampling_info,
        a.delivery_deadline::text AS delivery_deadline,
        a.position
      FROM audit_request_items a
      LEFT JOIN controls c ON c.id = a.control_id
      LEFT JOIN teams t ON t.id = a.requester_team_id
      WHERE a.tenant_id = ${ctx.tenantId}
        AND a.campaign_id = ${campaignId}::uuid
      ORDER BY a.position ASC, a.created_at ASC
    `
    requestItems = itemsRes.rows
  } catch {
    // ignora se tabela não existir ou erro
  }

  return {
    campaign: { id: c.id, name: c.name, status, due_date: due },
    kpis: {
      progress_pct: progressPct,
      days_left: daysLeft,
      pending_controls_total: pendingControlsTotal,
      pending_evidences_total: pendingEvidencesTotal,
      pending_evidences_new_today: pendingEvidencesNewToday,
      pending_by_dept: pendingByDept,
    },
    dept_progress: deptProgress,
    controls,
    requester_teams: requesterTeamsRes.rows,
    request_items: requestItems,
  }
}

function mockFollowUp(campaignId: string): AuditCampaignFollowUpData {
  return {
    campaign: {
      id: campaignId,
      name: "Revisão Anual 2024 (mock)",
      status: "active",
      due_date: null,
    },
    kpis: {
      progress_pct: 68,
      days_left: 45,
      pending_controls_total: 42,
      pending_evidences_total: 12,
      pending_evidences_new_today: 2,
      pending_by_dept: [
        { dept: "TI", count: 18 },
        { dept: "RH", count: 6 },
        { dept: "FIN", count: 12 },
        { dept: "JUR", count: 20 },
      ],
    },
    dept_progress: [
      { dept: "ti", label: "T.I.", icon: "💻", pct: 85 },
      { dept: "rh", label: "R.H.", icon: "👥", pct: 42 },
      { dept: "fin", label: "Financeiro", icon: "💳", pct: 60 },
      { dept: "jur", label: "Jurídico", icon: "⚖️", pct: 25 },
    ],
    requester_teams: [],
    request_items: [],
    controls: [
      {
        control_id: "mock-1",
        control_code: "CTL-2024-001",
        control_name: "Segurança de Acesso Físico",
        owner_name: "Carlos Silva",
        owner_avatar_url: null,
        phase: "evidence",
        deadline: "2024-10-15",
      },
      {
        control_id: "mock-2",
        control_code: "CTL-2024-045",
        control_name: "Retenção de Documentos Fiscais",
        owner_name: "Ana Oliveira",
        owner_avatar_url: null,
        phase: "review_text",
        deadline: "2024-10-18",
      },
      {
        control_id: "mock-3",
        control_code: "CTL-2024-012",
        control_name: "Políticas de Privacidade LGPD",
        owner_name: "Roberto Dias",
        owner_avatar_url: null,
        phase: "final_approval",
        deadline: "2024-10-12",
      },
    ],
  }
}

function normalizeItemType(kind: string): "pdf" | "screenshot" | "link" | "sheet" | "any" {
  const k = String(kind || "").trim().toLowerCase()
  if (k === "document" || k === "pdf") return "pdf"
  if (k === "screenshot") return "screenshot"
  if (k === "link") return "link"
  if (k === "spreadsheet" || k === "sheet") return "sheet"
  return "any"
}

function normalizeDateOrNull(v?: string | null): string | null {
  const s = String(v || "").trim()
  if (!s) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

export async function addAuditCampaignRequestItems(input: {
  campaignId: string
  items: AuditRequestItemInput[]
}): Promise<{ inserted: number }> {
  const ctx = await getContext()
  await ensureAuditCampaignsTables()

  const campaignId = String(input?.campaignId || "").trim()
  if (!campaignId) throw new Error("CampaignId inválido.")

  const campaignCheck = await sql<{ id: string }>`
    SELECT id::text AS id
    FROM audit_campaigns
    WHERE tenant_id = ${ctx.tenantId}::uuid
      AND id = ${campaignId}::uuid
    LIMIT 1
  `
  if (!campaignCheck.rows?.[0]?.id) throw new Error("Campanha não encontrada.")

  const maxPosRes = await sql<{ max_pos: number }>`
    SELECT COALESCE(MAX(position), 0)::int AS max_pos
    FROM audit_request_items
    WHERE tenant_id = ${ctx.tenantId}::uuid
      AND campaign_id = ${campaignId}::uuid
  `
  let pos = (maxPosRes.rows?.[0]?.max_pos ?? 0) + 1
  let inserted = 0

  for (const raw of input.items || []) {
    const title = String(raw?.title || "").trim()
    if (!title) continue

    const controlId = String(raw?.controlId || "").trim() || null
    const requesterTeamId = String(raw?.requesterTeamId || "").trim() || null
    if (controlId) {
      const ctlInCampaign = await sql<{ ok: number }>`
        SELECT 1::int AS ok
        FROM audit_campaign_controls
        WHERE tenant_id = ${ctx.tenantId}::uuid
          AND campaign_id = ${campaignId}::uuid
          AND control_id = ${controlId}::uuid
        LIMIT 1
      `
      if (!ctlInCampaign.rows?.[0]?.ok) {
        throw new Error(`Controle ${controlId} não pertence ao escopo da campanha.`)
      }
    }
    if (requesterTeamId) {
      const teamCheck = await sql<{ ok: number }>`
        SELECT 1::int AS ok
        FROM teams
        WHERE tenant_id = ${ctx.tenantId}::uuid
          AND id = ${requesterTeamId}::uuid
        LIMIT 1
      `
      if (!teamCheck.rows?.[0]?.ok) {
        throw new Error(`Time responsável inválido: ${requesterTeamId}`)
      }
    }

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
        ${ctx.tenantId}::uuid,
        ${campaignId}::uuid,
        ${controlId}::uuid,
        ${requesterTeamId}::uuid,
        ${title},
        ${String(raw?.instructions || "").trim() || null},
        ${normalizeItemType(raw?.kind || "any")},
        ${String(raw?.samplingInfo || "").trim() || null},
        ${normalizeDateOrNull(raw?.deliveryDeadline)},
        ${pos}
      )
    `

    pos++
    inserted++
  }

  revalidatePath(`/auditorias/${campaignId}`)
  revalidatePath(`/auditorias/${campaignId}/acompanhamento`)
  return { inserted }
}
