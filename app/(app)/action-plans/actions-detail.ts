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
  classification: RiskClassification
  impact: number
  likelihood: number
  risk_score: number
  status: RiskStatus
  owner_user_id: string | null
  owner_name: string | null
  created_at: string
  updated_at: string
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

  const riskRes = await sql<RiskDetail>`
    SELECT
      r.id,
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
    LEFT JOIN users u
      ON u.id = r.owner_user_id
     AND u.tenant_id = r.tenant_id
    WHERE r.tenant_id = ${ctx.tenantId}
      AND r.id = ${riskId}
    LIMIT 1
  `
  const risk = riskRes.rows[0]
  if (!risk) throw new Error("Risco não encontrado (tenant).")

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
