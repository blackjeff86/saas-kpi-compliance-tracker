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

  actor_name: string | null
  actor_email: string | null

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

  // ✅ KPI config updated
  if (entityType === "kpi" && action === "kpi_config_updated") {
    const bType = fmtVal(before?.kpi_type)
    const aType = fmtVal(after?.kpi_type)

    const bOp = fmtVal(before?.target_operator)
    const aOp = fmtVal(after?.target_operator)

    const bTv = fmtVal(before?.target_value)
    const aTv = fmtVal(after?.target_value)

    const bWarn =
      before?.warning_buffer_pct !== undefined ? `${Number(before.warning_buffer_pct) * 100}%` : "—"
    const aWarn =
      after?.warning_buffer_pct !== undefined ? `${Number(after.warning_buffer_pct) * 100}%` : "—"

    return `Configuração do KPI atualizada • ${kpiLabel} (tipo: ${bType} → ${aType}, meta: ${bOp} ${bTv} → ${aOp} ${aTv}, warning: ${bWarn} → ${aWarn})`
  }

  if (entityType === "kpi" && (action === "created" || action === "kpi_created")) {
    return `KPI criado • ${kpiLabel}`
  }
  if (entityType === "kpi" && (action === "updated" || action === "kpi_updated")) {
    return `KPI atualizado • ${kpiLabel}`
  }
  if (entityType === "kpi" && action === "deleted") {
    return `KPI removido • ${kpiLabel}`
  }

  if (entityType === "control" && action === "created") return `Controle criado`
  if (entityType === "control" && action === "updated") return `Controle atualizado`
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

      u.name::text AS actor_name,
      u.email::text AS actor_email,

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
    const actor =
      r.actor_name && r.actor_name.trim()
        ? r.actor_name
        : r.actor_email && r.actor_email.trim()
        ? r.actor_email
        : null

    return {
      id: r.id,
      entity_type: (r.entity_type || "") as any,
      summary: buildSummary(r),
      actor,
      created_at: r.created_at,
      action: r.action,
    }
  })
}
