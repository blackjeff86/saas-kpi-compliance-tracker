// app/(app)/execucoes/actions-auto-status.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"
import { computeAutoStatus } from "../lib/auto-status"

const VALID_DB_STATUSES = new Set([
  "in_target",
  "warning",
  "out_of_target",
  "unknown",
  "not_applicable",
])

function normalizeToDbStatus(raw: string) {
  const v = (raw || "").toLowerCase().trim()

  // ✅ mapeia retornos comuns (ok/gap/cores etc) para o enum do banco
  const map: Record<string, string> = {
    ok: "in_target",
    green: "in_target",
    effective: "in_target",
    pass: "in_target",
    in_target: "in_target",

    warning: "warning",
    yellow: "warning",
    warn: "warning",
    med: "warning",
    medium: "warning",
    moderate: "warning",

    gap: "out_of_target",
    red: "out_of_target",
    critical: "out_of_target",
    fail: "out_of_target",
    out: "out_of_target",
    out_of_target: "out_of_target",

    unknown: "unknown",
    "no-data": "unknown",
    nodata: "unknown",

    not_applicable: "not_applicable",
    "not-applicable": "not_applicable",
    na: "not_applicable",
    "n/a": "not_applicable",
  }

  return map[v] ?? v
}

export async function recomputeExecutionAutoStatus(executionId: string) {
  const ctx = await getContext()

  const { rows } = await sql<{
    kpi_type: string | null
    target_operator: string | null
    target_value: number | null
    target_boolean: boolean | null
    warning_buffer_pct: number | null
    result_numeric: number | null
    result_boolean: boolean | null
  }>`
    SELECT
      k.kpi_type::text AS kpi_type,
      k.target_operator::text AS target_operator,
      k.target_value,
      k.target_boolean,
      k.warning_buffer_pct,
      e.result_numeric,
      e.result_boolean
    FROM kpi_executions e
    JOIN kpis k ON k.id = e.kpi_id
    WHERE e.tenant_id = ${ctx.tenantId}
      AND e.id = ${executionId}
    LIMIT 1
  `

  const r = rows[0]
  if (!r) throw new Error("Execução não encontrada (tenant).")

  // ✅ buffer vem do KPI (fallback 5%)
  const buffer =
    typeof r.warning_buffer_pct === "number" && Number.isFinite(r.warning_buffer_pct)
      ? r.warning_buffer_pct
      : 0.05

  // ✅ sem meta => N/A
  // (para boolean, você pode decidir: se target_boolean é null também vira N/A)
  if (r.target_value === null && r.target_boolean === null) {
    await sql`
      UPDATE kpi_executions
      SET auto_status = 'not_applicable'
      WHERE tenant_id = ${ctx.tenantId}
        AND id = ${executionId}
    `
    return
  }

  // ✅ calcula usando computeAutoStatus (mesma regra do sistema)
  // Nota: computeAutoStatus atual usa target_value para boolean (>=1).
  // Se você quiser suportar target_boolean real, ajustamos o auto-status.ts depois.
  const auto = computeAutoStatus(
    {
      kpi_type: r.kpi_type,
      target_operator: r.target_operator,
      target_value: r.target_value,
    },
    {
      result_numeric: r.result_numeric,
      result_boolean: r.result_boolean,
    },
    buffer
  )

  const mapped = normalizeToDbStatus(String(auto || "unknown"))
  const safeAuto = VALID_DB_STATUSES.has(mapped) ? mapped : "unknown"

  await sql`
    UPDATE kpi_executions
    SET auto_status = ${safeAuto}
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${executionId}
  `
}
