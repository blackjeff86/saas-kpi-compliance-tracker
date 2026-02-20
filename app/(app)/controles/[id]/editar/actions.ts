// app/(app)/controles/[id]/editar/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../../../lib/context"

export type EditControlInitialData = {
  control: {
    id: string
    framework: string | null
    control_code: string
    control_name: string
    control_description: string | null
    control_goal: string | null
    control_status: string | null
    control_frequency: string | null
    control_type: string | null

    control_owner_email: string | null
    control_owner_name: string | null
    focal_point_email: string | null
    focal_point_name: string | null

    risk_code: string | null
    risk_name: string | null
    risk_description: string | null
    risk_classification: string | null
  }
  kpis: Array<{
    kpi_code: string
    kpi_name: string
    kpi_description: string | null
    kpi_type: string | null
    kpi_target_operator: string | null
    kpi_target_value: number | null
    kpi_warning_buffer_pct: number | null // no DB é 0.05, 0.1 etc
  }>
}

export async function fetchControlForEdit(controlId: string): Promise<EditControlInitialData> {
  const ctx = await getContext()

  const ctl = await sql<{
    id: string
    framework: string | null
    control_code: string
    control_name: string
    control_description: string | null
    control_goal: string | null
    control_status: string | null
    control_frequency: string | null
    control_type: string | null
    control_owner_email: string | null
    control_owner_name: string | null
    focal_point_email: string | null
    focal_point_name: string | null
    risk_code: string | null
    risk_name: string | null
    risk_description: string | null
    risk_classification: string | null
  }>`
    SELECT
      c.id::text AS id,
      f.name::text AS framework,
      c.control_code::text AS control_code,
      c.name::text AS control_name,
      c.description::text AS control_description,
      c.goal::text AS control_goal,
      c.status::text AS control_status,
      c.frequency::text AS control_frequency,
      c.control_type::text AS control_type,

      c.control_owner_email::text AS control_owner_email,
      c.control_owner_name::text AS control_owner_name,
      c.focal_point_email::text AS focal_point_email,
      c.focal_point_name::text AS focal_point_name,

      r.risk_code::text AS risk_code,
      r.title::text AS risk_name,
      r.description::text AS risk_description,
      r.classification::text AS risk_classification

    FROM controls c
    LEFT JOIN frameworks f ON f.id = c.framework_id
    LEFT JOIN risk_catalog r ON r.id = c.risk_id
    WHERE c.tenant_id = ${ctx.tenantId}::uuid
      AND c.id = ${controlId}::uuid
    LIMIT 1
  `
  if (!ctl.rowCount) throw new Error("Controle não encontrado")

  const kpis = await sql<{
    kpi_code: string
    kpi_name: string
    kpi_description: string | null
    kpi_type: string | null
    kpi_target_operator: string | null
    kpi_target_value: number | null
    kpi_warning_buffer_pct: number | null
  }>`
    SELECT
      k.kpi_code::text AS kpi_code,
      k.kpi_name::text AS kpi_name,
      k.kpi_description::text AS kpi_description,
      k.kpi_type::text AS kpi_type,
      k.target_operator::text AS kpi_target_operator,
      k.target_value AS kpi_target_value,
      k.warning_buffer_pct AS kpi_warning_buffer_pct
    FROM kpis k
    WHERE k.tenant_id = ${ctx.tenantId}::uuid
      AND k.control_id = ${controlId}::uuid
    ORDER BY k.kpi_code ASC
  `

  return { control: ctl.rows[0], kpis: kpis.rows }
}
