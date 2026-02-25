// app/(app)/action-plans/actions-create.ts
"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../lib/context"

function norm(v: any) {
  return String(v ?? "").trim()
}

function uuidOrNull(v: string) {
  const s = norm(v)
  if (!s) return null
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s
    )
  )
    return null
  return s
}

async function ensureOptionalOriginsOnActionPlans() {
  // Permite criar planos manuais sem origem obrigatória.
  await sql`ALTER TABLE action_plans ALTER COLUMN control_id DROP NOT NULL`
}

export type OriginItem = {
  id: string // UUID (não mostrar na UI)
  code: string // risk_code / control_code / kpi_code
  name: string // title / name / kpi_name
}

export type OriginOptions = {
  risks: OriginItem[]
  controls: OriginItem[]
  kpis: OriginItem[]
}

export async function fetchOriginOptions(): Promise<OriginOptions> {
  const ctx = await getContext()

  const [riskRes, controlRes, kpiRes] = await Promise.all([
    sql<{ id: string; code: string; name: string }>`
      SELECT
        r.id::text AS id,
        r.risk_code::text AS code,
        COALESCE(r.title::text,'') AS name
      FROM risk_catalog r
      WHERE r.tenant_id = ${ctx.tenantId}::uuid
      ORDER BY r.risk_code ASC, r.title ASC
      LIMIT 300
    `,
    sql<{ id: string; code: string; name: string }>`
      SELECT
        c.id::text AS id,
        c.control_code::text AS code,
        COALESCE(c.name::text,'') AS name
      FROM controls c
      WHERE c.tenant_id = ${ctx.tenantId}::uuid
      ORDER BY c.control_code ASC, c.name ASC
      LIMIT 300
    `,
    sql<{ id: string; code: string; name: string }>`
      SELECT
        k.id::text AS id,
        k.kpi_code::text AS code,
        COALESCE(k.kpi_name::text,'') AS name
      FROM kpis k
      WHERE k.tenant_id = ${ctx.tenantId}::uuid
      ORDER BY k.kpi_code ASC, k.kpi_name ASC
      LIMIT 500
    `,
  ])

  return {
    risks: riskRes.rows.map((x) => ({ id: x.id, code: x.code, name: x.name })),
    controls: controlRes.rows.map((x) => ({ id: x.id, code: x.code, name: x.name })),
    kpis: kpiRes.rows.map((x) => ({ id: x.id, code: x.code, name: x.name })),
  }
}

export async function createActionPlanManual(formData: FormData): Promise<void> {
  const ctx = await getContext()

  const title = norm(formData.get("title"))
  const description = norm(formData.get("description"))
  const responsible = norm(formData.get("responsible"))
  const dueDate = norm(formData.get("dueDate"))
  const priority = norm(formData.get("priority")) || "medium"

  // vêm do hidden (uuid)
  const riskId = uuidOrNull(norm(formData.get("riskId")))
  const controlId = uuidOrNull(norm(formData.get("controlId")))
  const kpiId = uuidOrNull(norm(formData.get("kpiId")))

  if (!title) throw new Error("Título é obrigatório.")
  if (!dueDate) throw new Error("Data estimada de conclusão é obrigatória.")

  await ensureOptionalOriginsOnActionPlans()

  let finalControlId = controlId

  // Se vier KPI, valida e, se necessário, deduz o controle dono do KPI.
  if (kpiId) {
    const kpiOwnerRes = await sql<{ id: string; control_id: string }>`
      SELECT k.id::text AS id, k.control_id::text AS control_id
      FROM kpis k
      WHERE k.tenant_id = ${ctx.tenantId}::uuid
        AND k.id = ${kpiId}::uuid
      LIMIT 1
    `
    const kpiOwner = kpiOwnerRes.rows[0]?.control_id ?? null
    if (!kpiOwnerRes.rows[0]) {
      throw new Error("KPI inválido para este tenant.")
    }
    if (!finalControlId) {
      finalControlId = kpiOwner
    } else if (finalControlId !== kpiOwner) {
      throw new Error("KPI não pertence ao controle selecionado.")
    }
  }

  if (finalControlId) {
    const controlRes = await sql<{ id: string }>`
      SELECT c.id::text AS id
      FROM controls c
      WHERE c.tenant_id = ${ctx.tenantId}::uuid
        AND c.id = ${finalControlId}::uuid
      LIMIT 1
    `
    if (!controlRes.rows[0]?.id) {
      throw new Error("Controle inválido para este tenant.")
    }
  }

  // action_plans.risk_id FK referencia risks(id). Se o risco vem só do risk_catalog,
  // precisamos garantir uma linha em risks antes de inserir o plano.
  if (riskId) {
    const [catalogRes, risksRes] = await Promise.all([
      sql<{ id: string; title: string; description: string | null; classification: string; risk_code: string; impact: number | null; likelihood: number | null }>`
        SELECT id::text AS id, title::text AS title, description, classification::text AS classification,
               risk_code::text AS risk_code, impact::int AS impact, likelihood::int AS likelihood
        FROM risk_catalog
        WHERE tenant_id = ${ctx.tenantId}::uuid AND id = ${riskId}::uuid LIMIT 1
      `,
      sql<{ id: string }>`
        SELECT id::text AS id FROM risks
        WHERE tenant_id = ${ctx.tenantId}::uuid AND id = ${riskId}::uuid LIMIT 1
      `,
    ])
    const inCatalog = catalogRes.rows[0]
    const inRisks = risksRes.rows[0]?.id

    if (!inCatalog && !inRisks) {
      throw new Error("Risco inválido para este tenant.")
    }

    // Se existe só no catálogo, cria linha em risks para satisfazer a FK
    if (inCatalog && !inRisks) {
      const imp = inCatalog.impact != null && inCatalog.impact >= 1 && inCatalog.impact <= 5 ? inCatalog.impact : 1
      const lik = inCatalog.likelihood != null && inCatalog.likelihood >= 1 && inCatalog.likelihood <= 5 ? inCatalog.likelihood : 1
      const score = imp * lik
      const cls = (inCatalog.classification || "low").toLowerCase()
      const validCls = ["low", "med", "high", "critical"].includes(cls) ? cls : "low"
      await sql`
        INSERT INTO risks (tenant_id, id, title, description, domain, classification, impact, likelihood, risk_score, status, created_at, updated_at)
        VALUES (
          ${ctx.tenantId}::uuid,
          ${riskId}::uuid,
          ${inCatalog.title || ""},
          ${inCatalog.description},
          ${inCatalog.risk_code || "catalog"},
          ${validCls}::risk_classification,
          ${imp},
          ${lik},
          ${score},
          'open'::risk_status,
          now(),
          now()
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
  }

  // defaults
  const status = "in_progress"

  // grava compatível com a sua tabela action_plans (conforme CSV)
  await sql`
    INSERT INTO action_plans (
      tenant_id,
      execution_id,
      control_id,
      kpi_id,
      risk_id,
      title,
      description,
      owner_user_id,
      due_date,
      priority,
      status,
      created_at,
      updated_at,
      closed_at,
      responsible_name,
      evidence_folder_url
    ) VALUES (
      ${ctx.tenantId}::uuid,
      NULL,
      ${finalControlId}::uuid,
      ${kpiId}::uuid,
      ${riskId}::uuid,
      ${title},
      ${description || null},
      NULL,
      ${dueDate}::date,
      ${priority},
      ${status},
      now(),
      now(),
      NULL,
      ${responsible || null},
      NULL
    )
  `

  revalidatePath("/action-plans")
  if (riskId) {
    revalidatePath(`/risks/${riskId}`)
  }
}
