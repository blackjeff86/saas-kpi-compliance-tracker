"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../lib/context"
import { recomputeExecutionAutoStatus } from "./actions-auto-status"

export async function saveExecutionResult(opts: {
  executionId: string
  result_numeric?: number | null
  result_notes?: string | null
  result_boolean?: boolean | null
}) {
  const ctx = await getContext()

  // garante tenant + existência
  const check = await sql`
    SELECT id
    FROM kpi_executions
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${opts.executionId}
    LIMIT 1
  `
  if (!check.rows[0]?.id) throw new Error("Execução não encontrada ou fora do tenant.")

  // atualiza resultado
  await sql`
    UPDATE kpi_executions
    SET
      result_numeric = ${opts.result_numeric ?? null},
      result_boolean = ${opts.result_boolean ?? null},
      result_notes = ${opts.result_notes ?? null},
      updated_at = NOW()
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${opts.executionId}
  `

  // recalcula auto_status (inclui warning)
  await recomputeExecutionAutoStatus(opts.executionId)

  revalidatePath(`/execucoes/${opts.executionId}`)
  revalidatePath("/execucoes")
  revalidatePath("/revisoes")
}
