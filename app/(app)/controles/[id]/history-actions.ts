// app/(app)/controles/[id]/history-actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../../lib/context"

export type ControlHistoryItem = {
  id: string
  entity_type: "control" | "kpi" | string
  summary: string
  actor: string | null
  created_at: string
  action: string
}

type RawRow = {
  id: string
  entity_type: string
  action: string
  created_at: string
  metadata: string | null

  actor_label: string | null

  kpi_code: string | null
  kpi_name: string | null
}

function safeJsonParse<T = any>(s?: string | null): T | null {
  if (!s) return null
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

function fmtVal(v: any) {
  if (v === null || v === undefined) return "—"
  if (typeof v === "string" && v.trim() === "") return "—"
  return String(v)
}

function formatMonthLabel(yyyyMm: string) {
  if (!/^\d{4}-\d{2}$/.test(yyyyMm)) return yyyyMm
  const [y, m] = yyyyMm.split("-").map((x) => Number(x))
  const monthsPt = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${monthsPt[(m || 1) - 1]}/${y}`
}

function humanStatus(s?: string | null) {
  const v = (s ?? "").toLowerCase()
  if (v === "in_target" || v === "green") return "Em Conformidade"
  if (v === "warning" || v === "yellow") return "Próximo da Meta"
  if (v === "out_of_target" || v === "red") return "Fora da Meta"
  if (v === "pending" || v === "unknown" || v === "") return "Aguardando Entrada"
  if (v === "overdue") return "Em Atraso"
  if (v === "not_applicable") return "Não aplicável"
  return fmtVal(s)
}

function labelForField(entityType: string, field: string): string {
  const e = (entityType || "").toLowerCase()
  const f = (field || "").toLowerCase()

  // CONTROL
  if (e === "control") {
    if (f === "control_code") return "ID do Controle"
    if (f === "name") return "Nome"
    if (f === "description") return "Descrição"
    if (f === "goal") return "Objetivo"
    if (f === "status") return "Status"
    if (f === "frequency") return "Frequência"
    if (f === "control_type") return "Tipo"
    if (f === "control_owner_email") return "Owner (email)"
    if (f === "control_owner_name") return "Owner (nome)"
    if (f === "focal_point_email") return "Focal (email)"
    if (f === "focal_point_name") return "Focal (nome)"
    if (f === "framework") return "Framework"
    if (f === "risk_code") return "Risk code"
    if (f === "risk_name") return "Risk name"
    if (f === "risk_description") return "Risk description"
    if (f === "risk_classification") return "Risk classification"
  }

  // KPI
  if (e === "kpi") {
    if (f === "kpi_name") return "Nome"
    if (f === "kpi_description") return "Descrição"
    if (f === "kpi_type") return "Tipo"
    if (f === "target_operator") return "Operador"
    if (f === "target_value") return "Meta"
    if (f === "warning_buffer_pct") return "Warning buffer"
    if (f === "control_id") return "Vinculado ao controle"
  }

  return field
}

function formatKpiFieldValue(field: string, value: any) {
  const f = (field || "").toLowerCase()
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return "—"

  // warning_buffer_pct: 0.05 -> 5%
  if (f === "warning_buffer_pct") {
    const n = Number(value)
    if (!Number.isFinite(n)) return fmtVal(value)
    return `${Math.round(n * 10000) / 100}%`
  }

  // kpi_type
  if (f === "kpi_type") {
    const s = String(value).toLowerCase()
    if (s === "number") return "Numérico"
    if (s === "percent") return "Percentual"
    if (s === "boolean") return "Booleano"
    return fmtVal(value)
  }

  // target_operator
  if (f === "target_operator") {
    const s = String(value).toLowerCase()
    if (s === "gte") return "≥"
    if (s === "lte") return "≤"
    if (s === "eq") return "="
    return fmtVal(value)
  }

  return fmtVal(value)
}

function summarizeObjectChanges(meta: any, entityType: string, baseTitle: string) {
  const summary = typeof meta?.summary === "string" ? meta.summary.trim() : ""
  if (summary) return summary

  // suporte a 2 formatos:
  // 1) meta.changes = [{ field, from, to }]
  // 2) meta.changes = { field: {from,to}, ... }  (como no actions.ts que te mandei pro control)
  let changesArr: Array<{ field: string; from: any; to: any }> = []

  if (Array.isArray(meta?.changes)) {
    changesArr = meta.changes
      .map((c: any) => ({
        field: String(c?.field || c?.key || ""),
        from: c?.from,
        to: c?.to,
      }))
      .filter((c: any) => c.field)
  } else if (meta?.changes && typeof meta.changes === "object") {
    changesArr = Object.entries(meta.changes).map(([field, v]: any) => ({
      field,
      from: v?.from,
      to: v?.to,
    }))
  }

  if (!changesArr.length) return null

  const parts = changesArr.map((c) => {
    const label = labelForField(entityType, c.field)
    const fromV = entityType === "kpi" ? formatKpiFieldValue(c.field, c.from) : fmtVal(c.from)
    const toV = entityType === "kpi" ? formatKpiFieldValue(c.field, c.to) : fmtVal(c.to)
    return `${label}: ${fromV} → ${toV}`
  })

  const text = parts.join("; ")
  if (text.length > 200) return `${baseTitle} (${changesArr.length} campos)`
  return `${baseTitle}: ${text}`
}

function buildSummary(row: RawRow) {
  const entityType = (row.entity_type || "").toLowerCase()
  const action = (row.action || "").toLowerCase()

  const meta = safeJsonParse<any>(row.metadata)
  const before = meta?.before ?? meta?.old ?? null
  const after = meta?.after ?? meta?.new ?? null

  const kpiLabel =
    row.kpi_code && row.kpi_name
      ? `${row.kpi_code} • ${row.kpi_name}`
      : row.kpi_code
      ? row.kpi_code
      : row.kpi_name
      ? row.kpi_name
      : "KPI"

  // ✅ Execução do KPI (novo evento)
  if (entityType === "kpi" && (action === "kpi_execution_created" || action === "kpi_execution_updated")) {
    const mes = typeof after?.mes_ref === "string" ? after.mes_ref : null
    const periodo = mes ? formatMonthLabel(mes) : "—"
    const resNum = after?.result_numeric ?? "—"
    const st = humanStatus(after?.auto_status)

    const verb = action === "kpi_execution_created" ? "Execução registrada" : "Execução atualizada"
    return `${verb} • ${kpiLabel} (período: ${periodo}, resultado: ${fmtVal(resNum)}, status: ${st})`
  }

  // ✅ KPI config updated (evento dedicado antigo)
  if (entityType === "kpi" && action === "kpi_config_updated") {
    const bType = fmtVal(before?.kpi_type)
    const aType = fmtVal(after?.kpi_type)

    const bOp = fmtVal(before?.target_operator)
    const aOp = fmtVal(after?.target_operator)

    const bTv = fmtVal(before?.target_value)
    const aTv = fmtVal(after?.target_value)

    const bWarn = before?.warning_buffer_pct !== undefined ? `${Number(before.warning_buffer_pct) * 100}%` : "—"
    const aWarn = after?.warning_buffer_pct !== undefined ? `${Number(after.warning_buffer_pct) * 100}%` : "—"

    return `Configuração do KPI atualizada • ${kpiLabel} (tipo: ${bType} → ${aType}, meta: ${bOp} ${bTv} → ${aOp} ${aTv}, warning: ${bWarn} → ${aWarn})`
  }

  // ✅ KPI created/updated/deleted
  if (entityType === "kpi" && (action === "created" || action === "kpi_created")) {
    return `KPI criado • ${kpiLabel}`
  }

  if (entityType === "kpi" && (action === "updated" || action === "kpi_updated")) {
    // ✅ se o audit vier com changes/before/after => mostra delta
    const s = summarizeObjectChanges(meta, "kpi", `KPI atualizado • ${kpiLabel}`)
    return s || `KPI atualizado • ${kpiLabel}`
  }

  if (entityType === "kpi" && action === "deleted") {
    return `KPI removido • ${kpiLabel}`
  }

  // ✅ CONTROL created/updated/deleted
  if (entityType === "control" && action === "created") return `Controle criado`

  if (entityType === "control" && action === "updated") {
    const s = summarizeObjectChanges(meta, "control", "Controle atualizado")
    return s || `Controle atualizado`
  }

  if (entityType === "control" && action === "deleted") return `Controle removido`

  return `${entityType.toUpperCase()} • ${row.action}`
}

export async function fetchControlHistory(controlId: string): Promise<ControlHistoryItem[]> {
  const ctx = await getContext()

  const { rows } = await sql<RawRow>`
    SELECT
      ae.id::text AS id,
      ae.entity_type::text AS entity_type,
      ae.action::text AS action,
      ae.created_at::text AS created_at,
      ae.metadata::text AS metadata,

      -- ✅ Regra: sem auth => actor_user_id = NULL => actor_label = NULL (UI mostra "Sistema")
      CASE
        WHEN ae.actor_user_id IS NULL THEN NULL
        ELSE COALESCE(NULLIF(btrim(u.name::text), ''), NULLIF(btrim(u.email::text), ''), NULL)
      END::text AS actor_label,

      k.kpi_code::text AS kpi_code,
      k.kpi_name::text AS kpi_name

    FROM audit_events ae

    LEFT JOIN users u
      ON u.tenant_id = ae.tenant_id
     AND u.id = ae.actor_user_id

    LEFT JOIN kpis k
      ON ae.entity_type = 'kpi'
     AND k.tenant_id = ae.tenant_id
     AND k.id = ae.entity_id

    WHERE ae.tenant_id = ${ctx.tenantId}
      AND (
        (ae.entity_type = 'control' AND ae.entity_id = ${controlId}::uuid)
        OR
        (ae.entity_type = 'kpi' AND k.control_id = ${controlId}::uuid)
      )
    ORDER BY ae.created_at DESC
    LIMIT 50
  `

  return (rows ?? []).map((r) => {
    return {
      id: r.id,
      entity_type: (r.entity_type || "") as any,
      summary: buildSummary(r),
      actor: r.actor_label && r.actor_label.trim() ? r.actor_label : null,
      created_at: r.created_at,
      action: r.action,
    }
  })
}