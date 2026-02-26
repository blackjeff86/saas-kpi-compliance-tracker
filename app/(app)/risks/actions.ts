"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../lib/context"
import { getRisksScope } from "../lib/authz"
import { ensureTeamIdColumns } from "../lib/rbac-migrations"

export type RiskRow = {
  id: string
  risk_code: string
  title: string
  source: string | null
  natureza: string | null
  classification: string
  responsible_name: string | null
  status: string
  impact: number | null
  likelihood: number | null
}

type HeatmapCellRow = {
  impact: number | null
  likelihood: number | null
  total: number
}

export type RiskHeatmapResult = {
  tenantId: string
  matrix: number[][]
  maxCell: number
  totals: { impact: number; likelihood: number; overall: number }
  missing: number
  totalFiltered: number
  validCount: number
}

async function ensureRiskCatalogColumns() {
  await sql`ALTER TABLE risk_catalog ADD COLUMN IF NOT EXISTS source text NULL`
  await sql`ALTER TABLE risk_catalog ADD COLUMN IF NOT EXISTS natureza text NULL`
  await sql`ALTER TABLE risk_catalog ADD COLUMN IF NOT EXISTS impact int NULL`
  await sql`ALTER TABLE risk_catalog ADD COLUMN IF NOT EXISTS likelihood int NULL`
  await sql`ALTER TABLE risk_catalog ADD COLUMN IF NOT EXISTS status text NULL`
}

export type RiskStatusValue = "open" | "mitigating" | "accepted" | "closed"

export async function updateRiskStatus(riskId: string, status: RiskStatusValue): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext()
  await ensureRiskCatalogColumns()

  const valid = ["open", "mitigating", "accepted", "closed"].includes(status) ? status : "open"

  try {
    const { rowCount: catalogCount } = await sql`
      UPDATE risk_catalog SET status = ${valid}, updated_at = now()
      WHERE tenant_id = ${ctx.tenantId}::uuid AND id = ${riskId}::uuid
    `
    const { rowCount: risksCount } = await sql`
      UPDATE risks SET status = ${valid}::risk_status, updated_at = now()
      WHERE tenant_id = ${ctx.tenantId}::uuid AND id = ${riskId}::uuid
    `
    if (!catalogCount && !risksCount) return { ok: false, error: "Risco não encontrado." }

    await sql`
      INSERT INTO audit_events (tenant_id, entity_type, entity_id, action, actor_user_id, metadata, created_at)
      VALUES (
        ${ctx.tenantId}::uuid,
        'risk',
        ${riskId}::uuid,
        'risk_status_updated',
        ${ctx.userId}::uuid,
        ${JSON.stringify({ status: valid })}::jsonb,
        now()
      )
    `

    revalidatePath("/risks")
    revalidatePath(`/risks/${riskId}`)
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function fetchRisksFilterOptions(): Promise<{
  classifications: string[]
  sources: string[]
  naturezas: string[]
}> {
  const ctx = await getContext()
  await ensureRiskCatalogColumns()
  await ensureTeamIdColumns()
  const scope = await getRisksScope(ctx.tenantId, ctx.userId)
  const teamIdsArr = scope.teamIds
  const noScope = scope.canViewAll || teamIdsArr.length === 0
  const oneTeam = !noScope && teamIdsArr.length === 1
  const firstTeamId = teamIdsArr[0] ?? ""
  const teamsArray = teamIdsArr as unknown as string

  const [classRes, sourceRes, naturezaRes] = noScope
    ? await Promise.all([
        sql<{ v: string }>`SELECT DISTINCT rc.classification::text AS v FROM risk_catalog rc WHERE rc.tenant_id = ${ctx.tenantId}::uuid AND rc.classification IS NOT NULL AND btrim(rc.classification::text) <> '' ORDER BY v`,
        sql<{ v: string }>`SELECT DISTINCT rc.source::text AS v FROM risk_catalog rc WHERE rc.tenant_id = ${ctx.tenantId}::uuid AND rc.source IS NOT NULL AND btrim(rc.source::text) <> '' ORDER BY v`,
        sql<{ v: string }>`SELECT DISTINCT rc.natureza::text AS v FROM risk_catalog rc WHERE rc.tenant_id = ${ctx.tenantId}::uuid AND rc.natureza IS NOT NULL AND btrim(rc.natureza::text) <> '' ORDER BY v`,
      ])
    : oneTeam
      ? await Promise.all([
          sql<{ v: string }>`SELECT DISTINCT rc.classification::text AS v FROM risk_catalog rc WHERE rc.tenant_id = ${ctx.tenantId}::uuid AND (rc.team_id IS NULL OR rc.team_id = ${firstTeamId}::uuid) AND rc.classification IS NOT NULL AND btrim(rc.classification::text) <> '' ORDER BY v`,
          sql<{ v: string }>`SELECT DISTINCT rc.source::text AS v FROM risk_catalog rc WHERE rc.tenant_id = ${ctx.tenantId}::uuid AND (rc.team_id IS NULL OR rc.team_id = ${firstTeamId}::uuid) AND rc.source IS NOT NULL AND btrim(rc.source::text) <> '' ORDER BY v`,
          sql<{ v: string }>`SELECT DISTINCT rc.natureza::text AS v FROM risk_catalog rc WHERE rc.tenant_id = ${ctx.tenantId}::uuid AND (rc.team_id IS NULL OR rc.team_id = ${firstTeamId}::uuid) AND rc.natureza IS NOT NULL AND btrim(rc.natureza::text) <> '' ORDER BY v`,
        ])
      : await Promise.all([
          sql<{ v: string }>`SELECT DISTINCT rc.classification::text AS v FROM risk_catalog rc WHERE rc.tenant_id = ${ctx.tenantId}::uuid AND (rc.team_id IS NULL OR rc.team_id = ANY(${teamsArray}::uuid[])) AND rc.classification IS NOT NULL AND btrim(rc.classification::text) <> '' ORDER BY v`,
          sql<{ v: string }>`SELECT DISTINCT rc.source::text AS v FROM risk_catalog rc WHERE rc.tenant_id = ${ctx.tenantId}::uuid AND (rc.team_id IS NULL OR rc.team_id = ANY(${teamsArray}::uuid[])) AND rc.source IS NOT NULL AND btrim(rc.source::text) <> '' ORDER BY v`,
          sql<{ v: string }>`SELECT DISTINCT rc.natureza::text AS v FROM risk_catalog rc WHERE rc.tenant_id = ${ctx.tenantId}::uuid AND (rc.team_id IS NULL OR rc.team_id = ANY(${teamsArray}::uuid[])) AND rc.natureza IS NOT NULL AND btrim(rc.natureza::text) <> '' ORDER BY v`,
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
  await ensureTeamIdColumns()
  const scope = await getRisksScope(ctx.tenantId, ctx.userId)
  const teamIdsArr = scope.teamIds
  const noScope = scope.canViewAll || teamIdsArr.length === 0
  const oneTeam = !noScope && teamIdsArr.length === 1
  const firstTeamId = teamIdsArr[0] ?? ""
  const teamsArray = teamIdsArr as unknown as string

  const qTrim = (opts.q ?? "").trim()
  const searchPattern = qTrim ? `%${qTrim}%` : null
  const classification = (opts.classification ?? "").trim() || null
  const source = (opts.source ?? "").trim() || null
  const natureza = (opts.natureza ?? "").trim() || null
  const limit = Math.max(1, Math.min(500, opts.limit ?? 50))
  const offset = Math.max(0, opts.offset ?? 0)

  const { rows } = noScope
    ? await sql<RiskRow & { total: number }>`
        WITH base AS (
          SELECT rc.id::text AS id, rc.risk_code::text AS risk_code, rc.title::text AS title, rc.source::text AS source, rc.natureza::text AS natureza, rc.classification::text AS classification, NULL::text AS responsible_name, COALESCE(rc.status::text, 'open')::text AS status, rc.impact::int AS impact, rc.likelihood::int AS likelihood, COUNT(*) OVER ()::int AS total
          FROM risk_catalog rc
          WHERE rc.tenant_id = ${ctx.tenantId}::uuid
            AND (${searchPattern}::text IS NULL OR rc.risk_code ILIKE ${searchPattern} OR rc.title ILIKE ${searchPattern} OR COALESCE(rc.description, '') ILIKE ${searchPattern})
            AND (${classification}::text IS NULL OR rc.classification::text = ${classification})
            AND (${source}::text IS NULL OR rc.source::text = ${source})
            AND (${natureza}::text IS NULL OR rc.natureza::text = ${natureza})
        )
        SELECT id, risk_code, title, source, natureza, classification, responsible_name, status, impact, likelihood, total FROM base ORDER BY risk_code ASC LIMIT ${limit} OFFSET ${offset}
      `
    : oneTeam
      ? await sql<RiskRow & { total: number }>`
          WITH base AS (
            SELECT rc.id::text AS id, rc.risk_code::text AS risk_code, rc.title::text AS title, rc.source::text AS source, rc.natureza::text AS natureza, rc.classification::text AS classification, NULL::text AS responsible_name, COALESCE(rc.status::text, 'open')::text AS status, rc.impact::int AS impact, rc.likelihood::int AS likelihood, COUNT(*) OVER ()::int AS total
            FROM risk_catalog rc
            WHERE rc.tenant_id = ${ctx.tenantId}::uuid AND (rc.team_id IS NULL OR rc.team_id = ${firstTeamId}::uuid)
              AND (${searchPattern}::text IS NULL OR rc.risk_code ILIKE ${searchPattern} OR rc.title ILIKE ${searchPattern} OR COALESCE(rc.description, '') ILIKE ${searchPattern})
              AND (${classification}::text IS NULL OR rc.classification::text = ${classification})
              AND (${source}::text IS NULL OR rc.source::text = ${source})
              AND (${natureza}::text IS NULL OR rc.natureza::text = ${natureza})
          )
          SELECT id, risk_code, title, source, natureza, classification, responsible_name, status, impact, likelihood, total FROM base ORDER BY risk_code ASC LIMIT ${limit} OFFSET ${offset}
        `
      : await sql<RiskRow & { total: number }>`
          WITH base AS (
            SELECT rc.id::text AS id, rc.risk_code::text AS risk_code, rc.title::text AS title, rc.source::text AS source, rc.natureza::text AS natureza, rc.classification::text AS classification, NULL::text AS responsible_name, COALESCE(rc.status::text, 'open')::text AS status, rc.impact::int AS impact, rc.likelihood::int AS likelihood, COUNT(*) OVER ()::int AS total
            FROM risk_catalog rc
            WHERE rc.tenant_id = ${ctx.tenantId}::uuid AND (rc.team_id IS NULL OR rc.team_id = ANY(${teamsArray}::uuid[]))
              AND (${searchPattern}::text IS NULL OR rc.risk_code ILIKE ${searchPattern} OR rc.title ILIKE ${searchPattern} OR COALESCE(rc.description, '') ILIKE ${searchPattern})
              AND (${classification}::text IS NULL OR rc.classification::text = ${classification})
              AND (${source}::text IS NULL OR rc.source::text = ${source})
              AND (${natureza}::text IS NULL OR rc.natureza::text = ${natureza})
          )
          SELECT id, risk_code, title, source, natureza, classification, responsible_name, status, impact, likelihood, total FROM base ORDER BY risk_code ASC LIMIT ${limit} OFFSET ${offset}
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
  await ensureTeamIdColumns()
  const scope = await getRisksScope(ctx.tenantId, ctx.userId)
  const teamIdsArr = scope.teamIds
  const noScope = scope.canViewAll || teamIdsArr.length === 0
  const oneTeam = !noScope && teamIdsArr.length === 1
  const firstTeamId = teamIdsArr[0] ?? ""
  const teamsArray = teamIdsArr as unknown as string

  const qTrim = (opts.q ?? "").trim()
  const searchPattern = qTrim ? `%${qTrim}%` : null
  const classification = (opts.classification ?? "").trim() || null
  const source = (opts.source ?? "").trim() || null
  const natureza = (opts.natureza ?? "").trim() || null

  const { rows } = noScope
    ? await sql<{ classification: string; cnt: number }>`
        SELECT LOWER(COALESCE(rc.classification::text, 'low')) AS classification, COUNT(*)::int AS cnt
        FROM risk_catalog rc
        WHERE rc.tenant_id = ${ctx.tenantId}::uuid
          AND (${searchPattern}::text IS NULL OR rc.risk_code ILIKE ${searchPattern} OR rc.title ILIKE ${searchPattern} OR COALESCE(rc.description, '') ILIKE ${searchPattern})
          AND (${classification}::text IS NULL OR rc.classification::text = ${classification})
          AND (${source}::text IS NULL OR rc.source::text = ${source})
          AND (${natureza}::text IS NULL OR rc.natureza::text = ${natureza})
        GROUP BY LOWER(COALESCE(rc.classification::text, 'low'))
      `
    : oneTeam
      ? await sql<{ classification: string; cnt: number }>`
          SELECT LOWER(COALESCE(rc.classification::text, 'low')) AS classification, COUNT(*)::int AS cnt
          FROM risk_catalog rc
          WHERE rc.tenant_id = ${ctx.tenantId}::uuid AND (rc.team_id IS NULL OR rc.team_id = ${firstTeamId}::uuid)
            AND (${searchPattern}::text IS NULL OR rc.risk_code ILIKE ${searchPattern} OR rc.title ILIKE ${searchPattern} OR COALESCE(rc.description, '') ILIKE ${searchPattern})
            AND (${classification}::text IS NULL OR rc.classification::text = ${classification})
            AND (${source}::text IS NULL OR rc.source::text = ${source})
            AND (${natureza}::text IS NULL OR rc.natureza::text = ${natureza})
          GROUP BY LOWER(COALESCE(rc.classification::text, 'low'))
        `
      : await sql<{ classification: string; cnt: number }>`
          SELECT LOWER(COALESCE(rc.classification::text, 'low')) AS classification, COUNT(*)::int AS cnt
          FROM risk_catalog rc
          WHERE rc.tenant_id = ${ctx.tenantId}::uuid AND (rc.team_id IS NULL OR rc.team_id = ANY(${teamsArray}::uuid[]))
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

/**
 * Heatmap 5x5:
 * - X = impact (1..5)
 * - Y = likelihood (1..5)
 * - matrix[likelihood-1][impact-1] = total
 *
 * ✅ Usa os MESMOS dados da tabela (fetchRisks) — mesma query base, agregamos em JS.
 */
export async function fetchRiskHeatmapMatrix(opts: {
  q?: string
  classification?: string
  source?: string
  natureza?: string
}): Promise<RiskHeatmapResult> {
  const ctx = await getContext()
  await ensureRiskCatalogColumns()

  // Busca os mesmos riscos que a tabela (mesma query, sem paginação) para agregar impact/likelihood
  const { rows: allRows } = await fetchRisks({
    ...opts,
    limit: 10000,
    offset: 0,
  })

  const matrix = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0))
  let maxCell = 0
  let sum = 0
  let impactSum = 0
  let likelihoodSum = 0
  let validCount = 0

  for (const r of allRows) {
    const impact = r.impact != null ? Number(r.impact) : NaN
    const likelihood = r.likelihood != null ? Number(r.likelihood) : NaN

    if (!Number.isFinite(impact) || !Number.isFinite(likelihood)) continue
    if (impact < 1 || impact > 5 || likelihood < 1 || likelihood > 5) continue

    validCount++
    const rowIdx = Math.floor(likelihood) - 1
    const colIdx = Math.floor(impact) - 1
    matrix[rowIdx][colIdx] = (matrix[rowIdx][colIdx] ?? 0) + 1
    maxCell = Math.max(maxCell, matrix[rowIdx][colIdx])

    sum += 1
    impactSum += impact
    likelihoodSum += likelihood
  }

  const totalFiltered = allRows.length
  const missing = Math.max(0, totalFiltered - validCount)

  return {
    tenantId: ctx.tenantId,
    matrix,
    maxCell,
    missing,
    totalFiltered,
    validCount,
    totals: {
      overall: sum,
      impact: sum > 0 ? Math.round((impactSum / sum) * 10) / 10 : 0,
      likelihood: sum > 0 ? Math.round((likelihoodSum / sum) * 10) / 10 : 0,
    },
  }
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

  const impactRaw = String(formData.get("impact") ?? "").trim()
  const likelihoodRaw = String(formData.get("likelihood") ?? "").trim()
  const impact = impactRaw ? Math.max(1, Math.min(5, Math.floor(Number(impactRaw)))) : null
  const likelihood = likelihoodRaw ? Math.max(1, Math.min(5, Math.floor(Number(likelihoodRaw)))) : null

  if (!riskCode) return { ok: false, error: "Código do risco é obrigatório." }
  if (!title) return { ok: false, error: "Título/nome do risco é obrigatório." }

  const validClassification = ["low", "med", "high", "critical"].includes(classification.toLowerCase())
    ? classification.toLowerCase()
    : "low"

  try {
    const ins = await sql<{ id: string }>`
      INSERT INTO risk_catalog (
        tenant_id, risk_code, title, description, classification, source, natureza, impact, likelihood
      )
      VALUES (
        ${ctx.tenantId}::uuid,
        ${riskCode},
        ${title},
        ${description},
        ${validClassification},
        ${source},
        ${natureza},
        ${impact},
        ${likelihood}
      )
      ON CONFLICT (tenant_id, risk_code)
      DO UPDATE SET
        title = COALESCE(EXCLUDED.title, risk_catalog.title),
        description = COALESCE(EXCLUDED.description, risk_catalog.description),
        classification = COALESCE(EXCLUDED.classification, risk_catalog.classification),
        source = COALESCE(EXCLUDED.source, risk_catalog.source),
        natureza = COALESCE(EXCLUDED.natureza, risk_catalog.natureza),
        impact = COALESCE(EXCLUDED.impact, risk_catalog.impact),
        likelihood = COALESCE(EXCLUDED.likelihood, risk_catalog.likelihood),
        updated_at = now()
      RETURNING id::text AS id
    `
    const riskId = ins.rows[0]?.id
    if (!riskId) return { ok: false, error: "Falha ao criar risco." }

    await sql`
      INSERT INTO audit_events (tenant_id, entity_type, entity_id, action, actor_user_id, metadata, created_at)
      VALUES (
        ${ctx.tenantId}::uuid,
        'risk',
        ${riskId}::uuid,
        'risk_created',
        ${ctx.userId}::uuid,
        ${JSON.stringify({ risk_code: riskCode, title, classification })}::jsonb,
        now()
      )
    `

    revalidatePath("/risks")
    return { ok: true, riskId }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("duplicate") || msg.includes("unique"))
      return { ok: false, error: "Já existe um risco com este código no tenant." }
    return { ok: false, error: msg }
  }
}

/** Atualiza impact e likelihood de um risco no catálogo (risk_catalog). */
export async function updateRiskCatalogImpactLikelihood(
  riskId: string,
  impact: number,
  likelihood: number
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext()
  await ensureRiskCatalogColumns()

  const i = Math.max(1, Math.min(5, Math.floor(Number(impact))))
  const l = Math.max(1, Math.min(5, Math.floor(Number(likelihood))))

  const { rowCount } = await sql`
    UPDATE risk_catalog
    SET impact = ${i}, likelihood = ${l}, updated_at = now()
    WHERE tenant_id = ${ctx.tenantId}::uuid AND id = ${riskId}::uuid
  `
  if (!rowCount) return { ok: false, error: "Risco não encontrado." }
  revalidatePath("/risks")
  revalidatePath(`/risks/${riskId}`)
  return { ok: true }
}

/** Atualiza todos os dados do risco (risk_catalog e/ou risks). */
export async function updateRisk(
  riskId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext()
  await ensureRiskCatalogColumns()

  const riskCode = String(formData.get("riskCode") ?? "").trim()
  const title = String(formData.get("title") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim() || null
  const classification = String(formData.get("classification") ?? "").trim() || "low"
  const source = String(formData.get("source") ?? "").trim() || null
  const natureza = String(formData.get("natureza") ?? "").trim() || null

  const impactRaw = String(formData.get("impact") ?? "").trim()
  const likelihoodRaw = String(formData.get("likelihood") ?? "").trim()
  const impact = impactRaw ? Math.max(1, Math.min(5, Math.floor(Number(impactRaw)))) : null
  const likelihood = likelihoodRaw ? Math.max(1, Math.min(5, Math.floor(Number(likelihoodRaw)))) : null

  if (!title) return { ok: false, error: "Título/nome do risco é obrigatório." }

  const validClassification = ["low", "med", "high", "critical"].includes(classification.toLowerCase())
    ? classification.toLowerCase()
    : "low"

  const score = impact != null && likelihood != null ? impact * likelihood : null

  try {
    // Busca estado anterior (risk_catalog ou risks) para auditoria
    const [catalogBefore, risksBefore] = await Promise.all([
      sql<{ risk_code: string; title: string; description: string | null; classification: string; source: string | null; natureza: string | null; impact: number | null; likelihood: number | null }>`
        SELECT risk_code::text, title::text, description, classification::text, source::text, natureza::text, impact::int, likelihood::int
        FROM risk_catalog WHERE tenant_id = ${ctx.tenantId}::uuid AND id = ${riskId}::uuid LIMIT 1
      `,
      sql<{ title: string; description: string | null; domain: string; classification: string; impact: number; likelihood: number }>`
        SELECT title::text, description, domain::text, classification::text, impact, likelihood
        FROM risks WHERE tenant_id = ${ctx.tenantId}::uuid AND id = ${riskId}::uuid LIMIT 1
      `,
    ])
    const catalogRow = catalogBefore.rows[0]
    const risksRow = risksBefore.rows[0]
    const before = catalogRow
      ? { ...catalogRow, risk_code: catalogRow.risk_code }
      : risksRow
        ? { risk_code: risksRow.domain, title: risksRow.title, description: risksRow.description, classification: risksRow.classification, source: null, natureza: null, impact: risksRow.impact, likelihood: risksRow.likelihood }
        : null

    // Atualiza risk_catalog se existir
    const { rowCount: catalogCount } = await sql`
      UPDATE risk_catalog
      SET
        risk_code = COALESCE(NULLIF(${riskCode}, ''), risk_code),
        title = ${title},
        description = ${description},
        classification = ${validClassification},
        source = ${source},
        natureza = ${natureza},
        impact = ${impact},
        likelihood = ${likelihood},
        updated_at = now()
      WHERE tenant_id = ${ctx.tenantId}::uuid AND id = ${riskId}::uuid
    `

    // Atualiza risks se existir (para riscos "full")
    const { rowCount: risksCount } = await sql`
      UPDATE risks
      SET
        title = ${title},
        description = ${description},
        domain = COALESCE(NULLIF(${riskCode}, ''), domain),
        classification = ${validClassification}::risk_classification,
        impact = COALESCE(${impact}, impact),
        likelihood = COALESCE(${likelihood}, likelihood),
        risk_score = COALESCE(${score}, risk_score),
        updated_at = now()
      WHERE tenant_id = ${ctx.tenantId}::uuid AND id = ${riskId}::uuid
    `

    if (!catalogCount && !risksCount) {
      return { ok: false, error: "Risco não encontrado." }
    }

    // Auditoria: registra alterações
    const afterCatalog = { risk_code: riskCode || before?.risk_code, title, description, classification: validClassification, source, natureza, impact, likelihood }
    const changes: Array<{ field: string; from: unknown; to: unknown }> = []
    const fields = ["risk_code", "title", "description", "classification", "source", "natureza", "impact", "likelihood"] as const
    for (const f of fields) {
      const bv = (before as any)?.[f]
      const av = (afterCatalog as any)[f]
      if (String(bv ?? "") !== String(av ?? "")) {
        changes.push({ field: f, from: bv, to: av })
      }
    }
    if (changes.length > 0) {
      await sql`
        INSERT INTO audit_events (tenant_id, entity_type, entity_id, action, actor_user_id, metadata, created_at)
        VALUES (
          ${ctx.tenantId}::uuid,
          'risk',
          ${riskId}::uuid,
          'risk_updated',
          ${ctx.userId}::uuid,
          ${JSON.stringify({ changes, before, after: afterCatalog })}::jsonb,
          now()
        )
      `
    }

    revalidatePath("/risks")
    revalidatePath(`/risks/${riskId}`)
    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
