"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

export type RiskStatus = "open" | "mitigating" | "accepted" | "closed"
export type RiskClassification = "low" | "med" | "high" | "critical"

export type RiskDetail = {
  id: string
  title: string
  description: string | null
  domain: string
  risk_code?: string
  classification: RiskClassification
  impact: number
  likelihood: number
  risk_score: number
  status: RiskStatus
  owner_user_id: string | null
  owner_name: string | null
  created_at: string
  updated_at: string
  /** 'catalog' = risk_catalog (sem assessments), 'full' = risks (com assessments) */
  source: "catalog" | "full"
}

export type RiskAssessmentRow = {
  id: string
  likelihood: number
  impact: number
  score: number
  classification: RiskClassification
  notes: string | null
  assessed_at: string
  assessed_by: string | null
  assessed_by_name: string | null
}

export type RiskActionPlanRow = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  owner_user_id: string | null
  owner_name: string | null
  created_at: string
}

export async function fetchRiskById(riskId: string): Promise<{
  risk: RiskDetail
  assessments: RiskAssessmentRow[]
  actionPlans: RiskActionPlanRow[]
}> {
  const ctx = await getContext()

  // 1) Tenta risk_catalog primeiro (lista de riscos usa esta tabela)
  const catalogRes = await sql<{ id: string; risk_code: string; title: string; description: string | null; classification: string; created_at: string; updated_at: string }>`
    SELECT
      id::text AS id,
      risk_code::text AS risk_code,
      title::text AS title,
      description::text AS description,
      classification::text AS classification,
      created_at::text AS created_at,
      COALESCE(updated_at::text, created_at::text) AS updated_at
    FROM risk_catalog
    WHERE tenant_id = ${ctx.tenantId}::uuid
      AND id = ${riskId}::uuid
    LIMIT 1
  `
  const catalog = catalogRes.rows[0]
  if (catalog) {
    const risk: RiskDetail = {
      id: catalog.id,
      title: catalog.title || "",
      description: catalog.description,
      domain: catalog.risk_code,
      risk_code: catalog.risk_code,
      classification: (catalog.classification || "low") as RiskClassification,
      impact: 0,
      likelihood: 0,
      risk_score: 0,
      status: "open" as RiskStatus,
      owner_user_id: null,
      owner_name: null,
      created_at: catalog.created_at,
      updated_at: catalog.updated_at,
      source: "catalog",
    }
    const actionPlansRes = await sql<RiskActionPlanRow>`
      SELECT
        ap.id,
        ap.title,
        ap.status::text AS status,
        ap.priority::text AS priority,
        ap.due_date::text AS due_date,
        ap.owner_user_id,
        u.name AS owner_name,
        ap.created_at::text AS created_at
      FROM action_plans ap
      LEFT JOIN users u ON u.id = ap.owner_user_id AND u.tenant_id = ap.tenant_id
      WHERE ap.tenant_id = ${ctx.tenantId}
        AND ap.risk_id = ${riskId}::uuid
      ORDER BY ap.created_at DESC
      LIMIT 50
    `
    return {
      risk,
      assessments: [],
      actionPlans: actionPlansRes.rows,
    }
  }

  // 2) Tenta tabela risks (riscos completos com assessments)
  const riskRes = await sql<{
    id: string
    title: string
    description: string | null
    domain: string
    classification: string
    impact: number
    likelihood: number
    risk_score: number
    status: string
    owner_user_id: string | null
    owner_name: string | null
    created_at: string
    updated_at: string
  }>`
    SELECT
      r.id::text AS id,
      r.title,
      r.description,
      r.domain,
      r.classification::text AS classification,
      r.impact,
      r.likelihood,
      r.risk_score,
      r.status::text AS status,
      r.owner_user_id,
      u.name AS owner_name,
      r.created_at::text AS created_at,
      r.updated_at::text AS updated_at
    FROM risks r
    LEFT JOIN users u ON u.id = r.owner_user_id AND u.tenant_id = r.tenant_id
    WHERE r.tenant_id = ${ctx.tenantId}
      AND r.id = ${riskId}::uuid
    LIMIT 1
  `
  const riskRow = riskRes.rows[0]
  if (!riskRow) {
    const anyCatalog = await sql<{ tenant_id: string }>`
      SELECT tenant_id::text AS tenant_id FROM risk_catalog WHERE id = ${riskId}::uuid LIMIT 1
    `
    const anyRisks = await sql<{ tenant_id: string }>`
      SELECT tenant_id::text AS tenant_id FROM risks WHERE id = ${riskId}::uuid LIMIT 1
    `
    const any = anyCatalog.rows[0] || anyRisks.rows[0]
    if (!any) {
      throw new Error(`Risco não existe. id=${String(riskId)}`)
    }
    throw new Error(`Risco existe, mas pertence a outro tenant.`)
  }

  const risk: RiskDetail = {
    ...riskRow,
    source: "full",
  }

  // Últimos assessments (timeline)
  const assessmentsRes = await sql<RiskAssessmentRow>`
    SELECT
      a.id,
      a.likelihood,
      a.impact,
      a.score,
      a.classification::text AS classification,
      a.notes,
      a.assessed_at::text AS assessed_at,
      a.assessed_by,
      u.name AS assessed_by_name
    FROM risk_assessments a
    LEFT JOIN users u
      ON u.id = a.assessed_by
     AND u.tenant_id = a.tenant_id
    WHERE a.tenant_id = ${ctx.tenantId}
      AND a.risk_id = ${riskId}
    ORDER BY a.assessed_at DESC
    LIMIT 50
  `

  // Action plans vinculados (nativo via action_plans.risk_id)
  const actionPlansRes = await sql<RiskActionPlanRow>`
    SELECT
      ap.id,
      ap.title,
      ap.status::text AS status,
      ap.priority::text AS priority,
      ap.due_date::text AS due_date,
      ap.owner_user_id,
      u.name AS owner_name,
      ap.created_at::text AS created_at
    FROM action_plans ap
    LEFT JOIN users u
      ON u.id = ap.owner_user_id
     AND u.tenant_id = ap.tenant_id
    WHERE ap.tenant_id = ${ctx.tenantId}
      AND ap.risk_id = ${riskId}
    ORDER BY ap.created_at DESC
    LIMIT 50
  `

  return {
    risk,
    assessments: assessmentsRes.rows,
    actionPlans: actionPlansRes.rows,
  }
}
