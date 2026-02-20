// app/(app)/action-plans/actions-list.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

export type ActionPlanListRow = {
  id: string
  title: string
  description: string | null
  responsible_name: string | null
  framework: string | null
  priority: string | null
  status: string | null
  due_date: string | null
  updated_at: string

  // origem execution
  execution_id: string | null
  control_code: string | null
  kpi_code: string | null
  auto_status: string | null
  workflow_status: string | null

  // origem risk
  risk_id: string | null
  risk_title: string | null
  risk_classification: string | null
}

type FetchActionPlansInput = {
  riskId?: string
  framework?: string
  responsible?: string
  status?: string
  priority?: string
}

function normalizeString(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function fetchActionPlans(input?: FetchActionPlansInput): Promise<ActionPlanListRow[]> {
  const ctx = await getContext()
  const riskId = normalizeString(input?.riskId)
  const framework = normalizeString(input?.framework)
  const responsible = normalizeString(input?.responsible)
  const responsibleLike = responsible ? `%${responsible}%` : null
  const status = normalizeString(input?.status)
  const priority = normalizeString(input?.priority)

  const { rows } = await sql<ActionPlanListRow>`
    SELECT
      ap.id,
      ap.title,
      ap.description,
      ap.responsible_name,
      COALESCE(fc.name, fk.name)::text AS framework,
      ap.priority::text AS priority,
      ap.status::text AS status,
      ap.due_date::text AS due_date,
      ap.updated_at::text AS updated_at,

      ap.execution_id,
      c.control_code,
      k.kpi_code,
      e.auto_status::text AS auto_status,
      e.workflow_status::text AS workflow_status,

      ap.risk_id,
      r.title AS risk_title,
      r.classification::text AS risk_classification

    FROM action_plans ap
    LEFT JOIN kpi_executions e
      ON e.id = ap.execution_id
     AND e.tenant_id = ap.tenant_id
    LEFT JOIN controls c
      ON c.id = ap.control_id
     AND c.tenant_id = ap.tenant_id
    LEFT JOIN kpis k
      ON k.id = ap.kpi_id
     AND k.tenant_id = ap.tenant_id
    LEFT JOIN controls ck
      ON ck.id = k.control_id
     AND ck.tenant_id = ap.tenant_id
    LEFT JOIN frameworks fc
      ON fc.id = c.framework_id
    LEFT JOIN frameworks fk
      ON fk.id = ck.framework_id

    LEFT JOIN risks r
      ON r.id = ap.risk_id
     AND r.tenant_id = ap.tenant_id

    WHERE ap.tenant_id = ${ctx.tenantId}
      AND (${riskId}::uuid IS NULL OR ap.risk_id = ${riskId}::uuid)
      AND (${framework}::text IS NULL OR COALESCE(fc.name, fk.name)::text = ${framework}::text)
      AND (${responsibleLike}::text IS NULL OR ap.responsible_name ILIKE ${responsibleLike}::text)
      AND (${status}::text IS NULL OR ap.status::text = ${status}::text)
      AND (${priority}::text IS NULL OR ap.priority::text = ${priority}::text)

    ORDER BY ap.updated_at DESC
    LIMIT 200
  `
  return rows
}

type ActionPlansFilterOptions = {
  frameworks: string[]
  responsibles: string[]
  statuses: string[]
  priorities: string[]
}

export async function fetchActionPlansFilterOptions(): Promise<ActionPlansFilterOptions> {
  const ctx = await getContext()

  const [frameworksRes, responsiblesRes, statusesRes, prioritiesRes] = await Promise.all([
    sql<{ value: string }>`
      SELECT DISTINCT COALESCE(fc.name, fk.name)::text AS value
      FROM action_plans ap
      LEFT JOIN controls c
        ON c.id = ap.control_id
       AND c.tenant_id = ap.tenant_id
      LEFT JOIN kpis k
        ON k.id = ap.kpi_id
       AND k.tenant_id = ap.tenant_id
      LEFT JOIN controls ck
        ON ck.id = k.control_id
       AND ck.tenant_id = ap.tenant_id
      LEFT JOIN frameworks fc
        ON fc.id = c.framework_id
      LEFT JOIN frameworks fk
        ON fk.id = ck.framework_id
      WHERE ap.tenant_id = ${ctx.tenantId}
        AND COALESCE(fc.name, fk.name) IS NOT NULL
        AND btrim(COALESCE(fc.name, fk.name)::text) <> ''
      ORDER BY value ASC
    `,
    sql<{ value: string }>`
      SELECT DISTINCT ap.responsible_name AS value
      FROM action_plans ap
      WHERE ap.tenant_id = ${ctx.tenantId}
        AND ap.responsible_name IS NOT NULL
        AND btrim(ap.responsible_name) <> ''
      ORDER BY value ASC
    `,
    sql<{ value: string }>`
      SELECT DISTINCT ap.status::text AS value
      FROM action_plans ap
      WHERE ap.tenant_id = ${ctx.tenantId}
        AND ap.status IS NOT NULL
        AND btrim(ap.status::text) <> ''
      ORDER BY value ASC
    `,
    sql<{ value: string }>`
      SELECT DISTINCT ap.priority::text AS value
      FROM action_plans ap
      WHERE ap.tenant_id = ${ctx.tenantId}
        AND ap.priority IS NOT NULL
        AND btrim(ap.priority::text) <> ''
      ORDER BY value ASC
    `,
  ])

  return {
    frameworks: frameworksRes.rows.map((row) => row.value),
    responsibles: responsiblesRes.rows.map((row) => row.value),
    statuses: statusesRes.rows.map((row) => row.value),
    priorities: prioritiesRes.rows.map((row) => row.value),
  }
}
