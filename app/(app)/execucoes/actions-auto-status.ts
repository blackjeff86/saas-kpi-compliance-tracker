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

export async function recomputeExecutionAutoStatus(executionId: string) {
  const ctx = await getContext()

  const { rows } = await sql<{
    kpi_type: string | null
    target_operator: string | null
    target_value: number | null
    result_numeric: number | null
    result_boolean: boolean | null
  }>`
    SELECT
      k.kpi_type::text AS kpi_type,
      k.target_operator::text AS target_operator,
      k.target_value,
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

  // Se não tem meta definida, podemos marcar como not_applicable
  // (mantenha assim se você quer N/A quando target não existe)
  if (r.target_value === null) {
    await sql`
      UPDATE kpi_executions
      SET auto_status = 'not_applicable'
      WHERE tenant_id = ${ctx.tenantId}
        AND id = ${executionId}
    `
    return
  }

  const auto = computeAutoStatus(
    { kpi_type: r.kpi_type, target_operator: r.target_operator, target_value: r.target_value },
    { result_numeric: r.result_numeric, result_boolean: r.result_boolean },
    0.05
  )

  const normalized = String(auto || "").toLowerCase()

  // Garantia extra: nunca gravar algo fora do enum do banco
  const safeAuto = VALID_DB_STATUSES.has(normalized) ? normalized : "unknown"

  await sql`
    UPDATE kpi_executions
    SET auto_status = ${safeAuto}
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${executionId}
  `
}
