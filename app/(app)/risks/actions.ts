"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../lib/context"

export type RiskRow = {
  id: string
  risk_code: string
  title: string
  source: string | null
  natureza: string | null
  classification: string
  responsible_name: string | null
  status: string
}

async function ensureRiskCatalogColumns() {
  await sql`ALTER TABLE risk_catalog ADD COLUMN IF NOT EXISTS source text NULL`
  await sql`ALTER TABLE risk_catalog ADD COLUMN IF NOT EXISTS natureza text NULL`
}

export async function fetchRisksFilterOptions(): Promise<{
  classifications: string[]
  sources: string[]
  naturezas: string[]
}> {
  const ctx = await getContext()
  await ensureRiskCatalogColumns()

  const [classRes, sourceRes, naturezaRes] = await Promise.all([
    sql<{ v: string }>`
      SELECT DISTINCT classification::text AS v
      FROM risk_catalog
      WHERE tenant_id = ${ctx.tenantId}::uuid
        AND classification IS NOT NULL
        AND btrim(classification::text) <> ''
      ORDER BY v
    `,
    sql<{ v: string }>`
      SELECT DISTINCT source::text AS v
      FROM risk_catalog
      WHERE tenant_id = ${ctx.tenantId}::uuid
        AND source IS NOT NULL
        AND btrim(source::text) <> ''
      ORDER BY v
    `,
    sql<{ v: string }>`
      SELECT DISTINCT natureza::text AS v
      FROM risk_catalog
      WHERE tenant_id = ${ctx.tenantId}::uuid
        AND natureza IS NOT NULL
        AND btrim(natureza::text) <> ''
      ORDER BY v
    `,
  ])

  return {
    classifications: classRes.rows.map((r) => r.v),
    sources: sourceRes.rows.map((r) => r.v),
    naturezas: naturezaRes.rows.map((r) => r.v),
  }
}

export async function fetchRisks(opts: {
  q?: string
  classification?: string
  source?: string
  natureza?: string
  limit?: number
  offset?: number
}): Promise<{ rows: RiskRow[]; total: number }> {
  const ctx = await getContext()
  await ensureRiskCatalogColumns()

  const qTrim = (opts.q ?? "").trim()
  const searchPattern = qTrim ? `%${qTrim}%` : null
  const classification = (opts.classification ?? "").trim() || null
  const source = (opts.source ?? "").trim() || null
  const natureza = (opts.natureza ?? "").trim() || null
  const limit = Math.max(1, Math.min(500, opts.limit ?? 50))
  const offset = Math.max(0, opts.offset ?? 0)

  const { rows } = await sql<RiskRow & { total: number }>`
    WITH base AS (
      SELECT
        rc.id::text AS id,
        rc.risk_code::text AS risk_code,
        rc.title::text AS title,
        rc.source::text AS source,
        rc.natureza::text AS natureza,
        rc.classification::text AS classification,
        NULL::text AS responsible_name,
        'Catalogado'::text AS status,
        COUNT(*) OVER ()::int AS total
      FROM risk_catalog rc
      WHERE rc.tenant_id = ${ctx.tenantId}::uuid
        AND (${searchPattern}::text IS NULL OR rc.risk_code ILIKE ${searchPattern} OR rc.title ILIKE ${searchPattern} OR COALESCE(rc.description, '') ILIKE ${searchPattern})
        AND (${classification}::text IS NULL OR rc.classification::text = ${classification})
        AND (${source}::text IS NULL OR rc.source::text = ${source})
        AND (${natureza}::text IS NULL OR rc.natureza::text = ${natureza})
    )
    SELECT id, risk_code, title, source, natureza, classification, responsible_name, status, total FROM base
    ORDER BY risk_code ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  const total = rows[0]?.total ?? 0
  return { rows, total }
}

export async function fetchRiskCountsByClassification(opts: {
  q?: string
  classification?: string
  source?: string
  natureza?: string
}): Promise<{ critical: number; high: number; med: number; low: number }> {
  const ctx = await getContext()
  await ensureRiskCatalogColumns()

  const qTrim = (opts.q ?? "").trim()
  const searchPattern = qTrim ? `%${qTrim}%` : null
  const classification = (opts.classification ?? "").trim() || null
  const source = (opts.source ?? "").trim() || null
  const natureza = (opts.natureza ?? "").trim() || null

  const { rows } = await sql<{ classification: string; cnt: number }>`
    SELECT LOWER(COALESCE(rc.classification::text, 'low')) AS classification, COUNT(*)::int AS cnt
    FROM risk_catalog rc
    WHERE rc.tenant_id = ${ctx.tenantId}::uuid
      AND (${searchPattern}::text IS NULL OR rc.risk_code ILIKE ${searchPattern} OR rc.title ILIKE ${searchPattern} OR COALESCE(rc.description, '') ILIKE ${searchPattern})
      AND (${classification}::text IS NULL OR rc.classification::text = ${classification})
      AND (${source}::text IS NULL OR rc.source::text = ${source})
      AND (${natureza}::text IS NULL OR rc.natureza::text = ${natureza})
    GROUP BY LOWER(COALESCE(rc.classification::text, 'low'))
  `

  const counts = { critical: 0, high: 0, med: 0, low: 0 }
  for (const r of rows) {
    const c = (r.classification || "low").toLowerCase()
    if (c === "critical") counts.critical = r.cnt
    else if (c === "high") counts.high = r.cnt
    else if (c === "med" || c === "medium") counts.med = r.cnt
    else counts.low = (counts.low || 0) + r.cnt
  }
  return counts
}

export async function createRisk(formData: FormData): Promise<{
  ok: boolean
  error?: string
  riskId?: string
}> {
  const ctx = await getContext()
  await ensureRiskCatalogColumns()

  const riskCode = String(formData.get("riskCode") ?? "").trim()
  const title = String(formData.get("title") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim() || null
  const classification = String(formData.get("classification") ?? "").trim() || "low"
  const source = String(formData.get("source") ?? "").trim() || null
  const natureza = String(formData.get("natureza") ?? "").trim() || null

  if (!riskCode) return { ok: false, error: "Código do risco é obrigatório." }
  if (!title) return { ok: false, error: "Título/nome do risco é obrigatório." }

  const validClassification = ["low", "med", "high", "critical"].includes(classification.toLowerCase())
    ? classification.toLowerCase()
    : "low"

  try {
    const ins = await sql<{ id: string }>`
      INSERT INTO risk_catalog (
        tenant_id, risk_code, title, description, classification, source, natureza
      )
      VALUES (
        ${ctx.tenantId}::uuid,
        ${riskCode},
        ${title},
        ${description},
        ${validClassification},
        ${source},
        ${natureza}
      )
      ON CONFLICT (tenant_id, risk_code)
      DO UPDATE SET
        title = COALESCE(EXCLUDED.title, risk_catalog.title),
        description = COALESCE(EXCLUDED.description, risk_catalog.description),
        classification = COALESCE(EXCLUDED.classification, risk_catalog.classification),
        source = COALESCE(EXCLUDED.source, risk_catalog.source),
        natureza = COALESCE(EXCLUDED.natureza, risk_catalog.natureza),
        updated_at = now()
      RETURNING id::text AS id
    `
    const riskId = ins.rows[0]?.id
    if (!riskId) return { ok: false, error: "Falha ao criar risco." }
    revalidatePath("/risks")
    return { ok: true, riskId }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("duplicate") || msg.includes("unique"))
      return { ok: false, error: "Já existe um risco com este código no tenant." }
    return { ok: false, error: msg }
  }
}
