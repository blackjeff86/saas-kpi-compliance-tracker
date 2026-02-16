"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"
import { revalidatePath } from "next/cache"

export async function recomputeAllAutoStatusForTenant(bufferPct = 0.05) {
  const ctx = await getContext()

  // Atenção: aqui assumimos que:
  // - k.target_operator tem valores tipo 'gte', 'lte', 'eq' (ou equivalentes)
  // - k.kpi_type tem algo que contém 'bool' quando for booleano
  // - e.result_numeric / e.result_boolean são as fontes do resultado
  await sql`
    WITH base AS (
      SELECT
        e.id AS execution_id,
        k.kpi_type::text AS kpi_type,
        k.target_operator::text AS op,
        k.target_value AS target,
        e.result_numeric AS val_num,
        e.result_boolean AS val_bool
      FROM kpi_executions e
      JOIN kpis k ON k.id = e.kpi_id
      WHERE e.tenant_id = ${ctx.tenantId}
    )
    UPDATE kpi_executions e
    SET auto_status =
      CASE
        -- sem meta => unknown
        WHEN b.target IS NULL THEN 'unknown'

        -- BOOLEAN: sem yellow (ou bate ou não bate)
        WHEN lower(coalesce(b.kpi_type,'')) LIKE '%bool%' THEN
          CASE
            WHEN b.val_bool IS NULL THEN 'unknown'
            WHEN b.val_bool = (b.target >= 1) THEN 'in_target'
            ELSE 'out_of_target'
          END

        -- NUMÉRICO: precisa de result_numeric
        WHEN b.val_num IS NULL THEN 'unknown'

        -- MAIOR MELHOR (>=)
        WHEN lower(coalesce(b.op,'')) IN ('gte','>=') THEN
          CASE
            WHEN b.val_num >= b.target THEN 'in_target'
            WHEN b.val_num >= (b.target * (1 - ${bufferPct})) THEN 'warning'
            ELSE 'out_of_target'
          END

        -- MENOR MELHOR (<=)
        WHEN lower(coalesce(b.op,'')) IN ('lte','<=') THEN
          CASE
            WHEN b.val_num <= b.target THEN 'in_target'
            WHEN b.val_num <= (b.target * (1 + ${bufferPct})) THEN 'warning'
            ELSE 'out_of_target'
          END

        -- IGUAL (=)
        WHEN lower(coalesce(b.op,'')) IN ('eq','=') THEN
          CASE
            WHEN b.val_num = b.target THEN 'in_target'
            ELSE 'out_of_target'
          END

        ELSE 'unknown'
      END
    FROM base b
    WHERE e.id = b.execution_id
      AND e.tenant_id = ${ctx.tenantId};
  `

  revalidatePath("/execucoes")
  revalidatePath("/revisoes")
  revalidatePath("/dashboard")
}
