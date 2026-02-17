"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

export type ControlRow = {
  id: string
  control_code: string
  name: string
  framework: string | null
  frequency: string | null
  risk_level: string | null
  created_at: string
}

export type FetchControlsInput = {
  q?: string
  limit?: number
  offset?: number
}

export async function fetchControlsPage(
  input: FetchControlsInput = {}
): Promise<{
  rows: ControlRow[]
  total: number
}> {
  const ctx = await getContext()

  const qRaw = (input.q ?? "").trim()
  const q = qRaw.length ? `%${qRaw}%` : null

  const limit = Math.max(1, Math.min(100, input.limit ?? 10))
  const offset = Math.max(0, input.offset ?? 0)

  // total
  const totalRes = await sql<{ total: number }>`
    SELECT COUNT(*)::int AS total
    FROM controls c
    LEFT JOIN frameworks f ON f.id = c.framework_id
    WHERE c.tenant_id = ${ctx.tenantId}
      AND (
        ${q}::text IS NULL
        OR c.name ILIKE ${q}
        OR c.control_code ILIKE ${q}
        OR f.name ILIKE ${q}
      )
  `
  const total = totalRes.rows?.[0]?.total ?? 0

  // page
  const { rows } = await sql<ControlRow>`
    SELECT
      c.id,
      c.control_code,
      c.name,
      f.name::text AS framework,
      c.frequency::text AS frequency,
      r.classification::text AS risk_level,
      c.created_at::text AS created_at
    FROM controls c
    LEFT JOIN frameworks f ON f.id = c.framework_id
    LEFT JOIN risk_catalog r ON r.id = c.risk_id
    WHERE c.tenant_id = ${ctx.tenantId}
      AND (
        ${q}::text IS NULL
        OR c.name ILIKE ${q}
        OR c.control_code ILIKE ${q}
        OR f.name ILIKE ${q}
      )
    ORDER BY c.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  return { rows, total }
}

// =============================
// ✅ IMPORTAÇÃO CSV (SIMPLES)
// =============================

export type ImportControlInput = {
  code: string
  name: string
  framework: string

  description?: string
  framework_ref?: string
  domain_section?: string
  frequency?: string
  frequency_key?: string
  status?: string
}

/**
 * ⚠️ Import simples usa helpers "Legacy" para não conflitar com o import completo.
 */
function normLegacy(v: any) {
  return String(v ?? "").trim()
}

const ALLOWED_FREQUENCY_LEGACY = new Set(["daily", "weekly", "monthly", "quarterly", "semiannual", "annual"])
const ALLOWED_STATUS_LEGACY = new Set(["active", "inactive", "pending"])

function pickFrequencyLegacy(v?: string) {
  const s = normLegacy(v).toLowerCase()
  if (ALLOWED_FREQUENCY_LEGACY.has(s)) return s
  return "monthly"
}

function pickStatusLegacy(v?: string) {
  const s = normLegacy(v).toLowerCase()
  if (ALLOWED_STATUS_LEGACY.has(s)) return s
  return "active"
}

export async function importarControles(
  items: ImportControlInput[]
): Promise<{
  imported: number
  updated: number
  skipped: number
  errors: { line: number; code?: string; message: string }[]
}> {
  const ctx = await getContext()

  if (!Array.isArray(items) || items.length === 0) {
    return { imported: 0, updated: 0, skipped: 0, errors: [{ line: 0, message: "Nenhum item para importar." }] }
  }

  const max = 2000
  if (items.length > max) {
    return {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [{ line: 0, message: `Arquivo muito grande. Limite atual: ${max} linhas.` }],
    }
  }

  let imported = 0
  let updated = 0
  let skipped = 0
  const errors: { line: number; code?: string; message: string }[] = []

  const frameworkCache = new Map<string, string>()

  for (let i = 0; i < items.length; i++) {
    const line = i + 1
    const raw = items[i]

    const code = normLegacy(raw.code)
    const name = normLegacy(raw.name)
    const frameworkName = normLegacy(raw.framework)

    if (!code || !name || !frameworkName) {
      skipped++
      errors.push({ line, code: code || undefined, message: "Campos obrigatórios ausentes (code, name, framework)." })
      continue
    }

    const description = normLegacy(raw.description) || null
    const framework_ref = normLegacy(raw.framework_ref) || null
    const domain_section = normLegacy(raw.domain_section) || null
    const frequency = pickFrequencyLegacy(raw.frequency)
    const frequency_key = normLegacy(raw.frequency_key) || null
    const status = pickStatusLegacy(raw.status)

    const fwKey = frameworkName.toLowerCase()

    try {
      let frameworkId = frameworkCache.get(fwKey)
      if (!frameworkId) {
        const fwRes = await sql<{ id: string }>`
          SELECT id
          FROM frameworks
          WHERE tenant_id = ${ctx.tenantId}
            AND lower(name) = lower(${frameworkName})
          LIMIT 1
        `
        frameworkId = fwRes.rows?.[0]?.id

        if (!frameworkId) {
          const insFw = await sql<{ id: string }>`
            INSERT INTO frameworks (tenant_id, name)
            VALUES (${ctx.tenantId}, ${frameworkName})
            RETURNING id
          `
          frameworkId = insFw.rows?.[0]?.id
        }

        if (!frameworkId) throw new Error("Falha ao resolver framework_id.")
        frameworkCache.set(fwKey, frameworkId)
      }

      const ex = await sql<{ id: string }>`
        SELECT id
        FROM controls
        WHERE tenant_id = ${ctx.tenantId}
          AND control_code = ${code}
        LIMIT 1
      `
      const existingId = ex.rows?.[0]?.id

      if (existingId) {
        await sql`
          UPDATE controls
          SET
            name = ${name},
            description = ${description},
            framework_id = ${frameworkId},
            framework_ref = ${framework_ref},
            domain_section = ${domain_section},
            frequency = ${frequency},
            frequency_key = ${frequency_key},
            status = ${status},
            updated_at = now()
          WHERE id = ${existingId}
            AND tenant_id = ${ctx.tenantId}
        `
        updated++
      } else {
        await sql`
          INSERT INTO controls (
            tenant_id,
            control_code,
            name,
            description,
            framework_id,
            framework_ref,
            domain_section,
            frequency,
            frequency_key,
            status
          )
          VALUES (
            ${ctx.tenantId},
            ${code},
            ${name},
            ${description},
            ${frameworkId},
            ${framework_ref},
            ${domain_section},
            ${frequency},
            ${frequency_key},
            ${status}
          )
        `
        imported++
      }
    } catch (e: any) {
      skipped++
      errors.push({ line, code, message: e?.message || "Erro ao importar linha." })
    }
  }

  return { imported, updated, skipped, errors }
}

// =============================
// ✅ IMPORTAÇÃO CSV (COMPLETA: CONTROLE + RISCO + KPI)
// =============================

export type ImportRow = {
  framework: string
  control_code: string
  control_name: string
  control_description?: string
  control_status?: string
  control_frequency?: string
  control_type?: string
  control_owner_email?: string
  focal_point_email?: string

  risk_code?: string
  risk_name?: string
  risk_description?: string
  risk_classification?: string

  kpi_code?: string
  kpi_name?: string
  kpi_description?: string
  kpi_target?: string | number
}

function norm(v: any) {
  return String(v ?? "").trim()
}

function normLower(v: any) {
  return norm(v).toLowerCase()
}

const CONTROL_STATUS_MAP: Record<string, "active" | "inactive" | "pending"> = {
  ativo: "active",
  active: "active",
  inativo: "inactive",
  inactive: "inactive",
  pendente: "pending",
  pending: "pending",
}

const FREQ_MAP: Record<string, "daily" | "weekly" | "monthly" | "quarterly" | "semiannual" | "annual"> = {
  diario: "daily",
  diário: "daily",
  daily: "daily",

  semanal: "weekly",
  weekly: "weekly",

  mensal: "monthly",
  monthly: "monthly",

  trimestral: "quarterly",
  quarterly: "quarterly",

  semestral: "semiannual",
  semiannual: "semiannual",

  anual: "annual",
  annual: "annual",
  yearly: "annual",
}

// ✅ enum do banco agora é risk_classification_new e NÃO aceita "med"
// valores esperados: low | medium | high | critical
const RISK_CLASS_MAP: Record<string, "critical" | "high" | "medium" | "low"> = {
  critico: "critical",
  crítico: "critical",
  critica: "critical",
  crítica: "critical",
  critical: "critical",
  crit: "critical",

  alto: "high",
  high: "high",

  // tudo que for "med"/"médio"/"moderado"/"moderate"/"medium" vira "medium"
  medio: "medium",
  médio: "medium",
  moderado: "medium",
  moderate: "medium",
  med: "medium",
  medium: "medium",

  baixo: "low",
  low: "low",
}

function pickRiskClass(v?: string) {
  const s = normLower(v)
  return RISK_CLASS_MAP[s] ?? "medium"
}

const TYPE_MAP: Record<string, "preventive" | "detective" | "corrective"> = {
  preventivo: "preventive",
  preventive: "preventive",

  detectivo: "detective",
  detective: "detective",

  corretivo: "corrective",
  corrective: "corrective",
}

function pickControlStatus(v?: string) {
  const s = normLower(v)
  return CONTROL_STATUS_MAP[s] ?? "active"
}

function pickFrequency(v?: string) {
  const s = normLower(v)
  return FREQ_MAP[s] ?? "monthly"
}

function pickType(v?: string) {
  const s = normLower(v)
  return TYPE_MAP[s] ?? null
}

async function resolveOrCreateUserIdByEmail(emailRaw: string | undefined, tenantId: string) {
  const email = norm(emailRaw)
  if (!email) return null

  const found = await sql<{ id: string }>`
    SELECT id FROM users
    WHERE tenant_id = ${tenantId} AND lower(email) = lower(${email})
    LIMIT 1
  `
  if (found.rows?.[0]?.id) return found.rows[0].id

  const name = email.split("@")[0]?.replace(/[._-]+/g, " ")?.trim() || "User"

  const ins = await sql<{ id: string }>`
    INSERT INTO users (tenant_id, name, email, role)
    VALUES (${tenantId}, ${name}, ${email}, 'viewer')
    RETURNING id
  `
  return ins.rows?.[0]?.id ?? null
}

async function resolveOrCreateFrameworkId(frameworkNameRaw: string, tenantId: string, cache: Map<string, string>) {
  const frameworkName = norm(frameworkNameRaw)
  const key = frameworkName.toLowerCase()
  if (!frameworkName) throw new Error("Framework ausente.")

  const cached = cache.get(key)
  if (cached) return cached

  const f = await sql<{ id: string }>`
    SELECT id FROM frameworks
    WHERE tenant_id = ${tenantId} AND lower(name) = lower(${frameworkName})
    LIMIT 1
  `
  let id = f.rows?.[0]?.id

  if (!id) {
    const ins = await sql<{ id: string }>`
      INSERT INTO frameworks (tenant_id, name)
      VALUES (${tenantId}, ${frameworkName})
      RETURNING id
    `
    id = ins.rows?.[0]?.id
  }

  if (!id) throw new Error("Falha ao resolver framework_id.")
  cache.set(key, id)
  return id
}

async function resolveOrCreateRiskId(row: ImportRow, tenantId: string, riskCache: Map<string, string>) {
  const riskCode = norm(row.risk_code)
  if (!riskCode) return null

  const key = riskCode.toLowerCase()
  const cached = riskCache.get(key)
  if (cached) return cached

  const existing = await sql<{ id: string }>`
    SELECT id FROM risk_catalog
    WHERE tenant_id = ${tenantId} AND lower(risk_code) = lower(${riskCode})
    LIMIT 1
  `
  let id = existing.rows?.[0]?.id

  const title = norm(row.risk_name) || null
  const description = norm(row.risk_description) || norm(row.risk_name) || "—"
  const classification = pickRiskClass(row.risk_classification)

  if (id) {
    // ✅ SEM CAST: deixa o Postgres converter para o tipo real da coluna (risk_classification_new ou outro)
    await sql`
      UPDATE risk_catalog
      SET
        title = ${title},
        description = ${description},
        classification = ${classification},
        updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `
  } else {
    const ins = await sql<{ id: string }>`
      INSERT INTO risk_catalog (tenant_id, risk_code, title, description, classification)
      VALUES (
        ${tenantId},
        ${riskCode},
        ${title},
        ${description},
        ${classification}
      )
      RETURNING id
    `
    id = ins.rows?.[0]?.id
  }

  if (!id) throw new Error("Falha ao resolver risk_id.")
  riskCache.set(key, id)
  return id
}

export async function importarControlesCompleto(
  items: ImportRow[]
): Promise<{
  controls_imported: number
  controls_updated: number
  kpis_imported: number
  kpis_updated: number
  skipped: number
  errors: { line: number; message: string; control_code?: string; kpi_code?: string }[]
}> {
  const ctx = await getContext()
  const tenantId = ctx.tenantId

  if (!Array.isArray(items) || items.length === 0) {
    return {
      controls_imported: 0,
      controls_updated: 0,
      kpis_imported: 0,
      kpis_updated: 0,
      skipped: 0,
      errors: [{ line: 0, message: "Nenhum item para importar." }],
    }
  }

  const groups = new Map<string, { rows: { row: ImportRow; line: number }[] }>()
  items.forEach((r, idx) => {
    const controlCode = norm(r.control_code)
    if (!controlCode) return
    const key = controlCode.toLowerCase()
    const g = groups.get(key) ?? { rows: [] }
    g.rows.push({ row: r, line: idx + 1 })
    groups.set(key, g)
  })

  const fwCache = new Map<string, string>()
  const riskCache = new Map<string, string>()

  let controls_imported = 0
  let controls_updated = 0
  let kpis_imported = 0
  let kpis_updated = 0
  let skipped = 0
  const errors: { line: number; message: string; control_code?: string; kpi_code?: string }[] = []

  for (const [, g] of groups) {
    const base = g.rows[0]
    const r0 = base.row
    const control_code = norm(r0.control_code)

    try {
      const framework_id = await resolveOrCreateFrameworkId(r0.framework, tenantId, fwCache)
      const owner_user_id = await resolveOrCreateUserIdByEmail(r0.control_owner_email, tenantId)
      const focal_point_user_id = await resolveOrCreateUserIdByEmail(r0.focal_point_email, tenantId)
      const risk_id = await resolveOrCreateRiskId(r0, tenantId, riskCache)

      const name = norm(r0.control_name)
      if (!name) throw new Error("control_name ausente.")

      const description = norm(r0.control_description) || null
      const status = pickControlStatus(r0.control_status)
      const frequency = pickFrequency(r0.control_frequency)
      const type = pickType(r0.control_type)

      const ex = await sql<{ id: string }>`
        SELECT id FROM controls
        WHERE tenant_id = ${tenantId} AND control_code = ${control_code}
        LIMIT 1
      `
      let controlId = ex.rows?.[0]?.id

      if (controlId) {
        await sql`
          UPDATE controls
          SET
            name = ${name},
            description = ${description},
            framework_id = ${framework_id},
            risk_id = ${risk_id},
            frequency = ${frequency},
            status = ${status},
            owner_user_id = ${owner_user_id},
            focal_point_user_id = ${focal_point_user_id},
            type = ${type},
            updated_at = now()
          WHERE id = ${controlId} AND tenant_id = ${tenantId}
        `
        controls_updated++
      } else {
        const ins = await sql<{ id: string }>`
          INSERT INTO controls (
            tenant_id, control_code, name, description,
            framework_id, risk_id, frequency, status,
            owner_user_id, focal_point_user_id, type
          )
          VALUES (
            ${tenantId},
            ${control_code},
            ${name},
            ${description},
            ${framework_id},
            ${risk_id},
            ${frequency},
            ${status},
            ${owner_user_id},
            ${focal_point_user_id},
            ${type}
          )
          RETURNING id
        `
        controlId = ins.rows?.[0]?.id
        if (!controlId) throw new Error("Falha ao criar control.")
        controls_imported++
      }

      const kpiSeen = new Set<string>()

      for (const item of g.rows) {
        const rr = item.row
        const line = item.line

        const kpi_code = norm(rr.kpi_code)
        if (!kpi_code) continue

        const kpiKey = kpi_code.toLowerCase()
        if (kpiSeen.has(kpiKey)) continue
        kpiSeen.add(kpiKey)

        const kpi_name = norm(rr.kpi_name)
        if (!kpi_name) {
          skipped++
          errors.push({ line, control_code, kpi_code, message: "kpi_name ausente." })
          continue
        }

        const kpi_description = norm(rr.kpi_description) || null
        const target_value_raw = norm(rr.kpi_target)
        const target_value = target_value_raw ? Number(target_value_raw.replace(",", ".")) : null
        if (target_value_raw && !Number.isFinite(target_value as any)) {
          skipped++
          errors.push({ line, control_code, kpi_code, message: "kpi_target inválido (use número)." })
          continue
        }

        const existsKpi = await sql<{ id: string }>`
          SELECT id FROM kpis
          WHERE tenant_id = ${tenantId} AND kpi_code = ${kpi_code}
          LIMIT 1
        `
        const existingKpiId = existsKpi.rows?.[0]?.id

        if (existingKpiId) {
          await sql`
            UPDATE kpis
            SET
              control_id = ${controlId},
              name = ${kpi_name},
              description = ${kpi_description},
              target_value = ${target_value},
              updated_at = now()
            WHERE id = ${existingKpiId} AND tenant_id = ${tenantId}
          `
          kpis_updated++
        } else {
          await sql`
            INSERT INTO kpis (
              tenant_id, kpi_code, control_id, name, description, target_value
            )
            VALUES (
              ${tenantId},
              ${kpi_code},
              ${controlId},
              ${kpi_name},
              ${kpi_description},
              ${target_value}
            )
          `
          kpis_imported++
        }
      }
    } catch (e: any) {
      skipped += g.rows.length
      errors.push({
        line: base.line,
        control_code: norm(r0.control_code) || undefined,
        message: e?.message || "Erro ao importar controle/grupo.",
      })
    }
  }

  return { controls_imported, controls_updated, kpis_imported, kpis_updated, skipped, errors }
}
