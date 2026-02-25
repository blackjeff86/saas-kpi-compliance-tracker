// app/(app)/risks/history-actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

export type RiskHistoryItem = {
  id: string
  summary: string
  actor: string | null
  created_at: string
  action: string
}

const RISK_FIELD_LABELS: Record<string, string> = {
  risk_code: "Código",
  title: "Título",
  description: "Descrição",
  classification: "Criticidade",
  source: "Fonte",
  natureza: "Natureza",
  impact: "Impacto",
  likelihood: "Probabilidade",
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "string" && v.trim() === "") return "—"
  return String(v)
}

function buildSummary(action: string, metadata: { changes?: Array<{ field: string; from: unknown; to: unknown }>; summary?: string } | null): string {
  if (metadata?.summary && typeof metadata.summary === "string") {
    return metadata.summary.trim()
  }
  if (action === "risk_created") return "Risco criado no catálogo"
  if (action === "risk_update_added") {
    const summary = (metadata as any)?.summary
    return summary ? `Atualização: ${summary}` : "Atualização registrada"
  }
  if (action === "risk_status_updated") {
    const status = (metadata as any)?.status
    const labels: Record<string, string> = { open: "Aberto", mitigating: "Em mitigação", accepted: "Aceito", closed: "Fechado" }
    return `Status alterado para ${labels[status] ?? status ?? "—"}`
  }
  if (action === "risk_assessed") {
    const score = (metadata as any)?.score
    const cls = (metadata as any)?.classification
    if (score != null || cls) {
      return `Reavaliação: score ${fmtVal(score)} • classificação ${fmtVal(cls)}`
    }
    return "Reavaliação registrada"
  }
  const changes = metadata?.changes
  if (!changes?.length) return "Risco atualizado"
  const parts = changes.map((c) => {
    const label = RISK_FIELD_LABELS[c.field] || c.field
    return `${label}: ${fmtVal(c.from)} → ${fmtVal(c.to)}`
  })
  return parts.join("; ")
}

export async function fetchRiskHistory(riskId: string): Promise<RiskHistoryItem[]> {
  const ctx = await getContext()

  const { rows } = await sql<{
    id: string
    action: string
    created_at: string
    metadata: string | null
    actor_label: string | null
  }>`
    SELECT
      ae.id::text AS id,
      ae.action::text AS action,
      ae.created_at::text AS created_at,
      ae.metadata::text AS metadata,
      CASE
        WHEN ae.actor_user_id IS NULL THEN NULL
        ELSE COALESCE(NULLIF(btrim(u.name::text), ''), NULLIF(btrim(u.email::text), ''), NULL)
      END::text AS actor_label
    FROM audit_events ae
    LEFT JOIN users u
      ON u.tenant_id = ae.tenant_id AND u.id = ae.actor_user_id
    WHERE ae.tenant_id = ${ctx.tenantId}
      AND ae.entity_type = 'risk'
      AND ae.entity_id = ${riskId}::uuid
    ORDER BY ae.created_at DESC
    LIMIT 50
  `

  return (rows ?? []).map((r) => {
    let meta: any = null
    try {
      meta = r.metadata ? JSON.parse(r.metadata) : null
    } catch {}
    return {
      id: r.id,
      summary: buildSummary(r.action, meta),
      actor: r.actor_label?.trim() || null,
      created_at: r.created_at,
      action: r.action,
    }
  })
}
