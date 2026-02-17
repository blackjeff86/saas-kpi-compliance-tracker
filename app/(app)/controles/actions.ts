// app/(app)/controles/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

// =============================
// TYPES
// =============================

export type ControlRow = {
  id: string
  control_code: string
  name: string
  framework: string | null
  frequency: string | null
  risk_level: string | null
  created_at: string

  // ✅ mês referência (YYYY-MM) - usado para cálculo do status do mês (execuções)
  mes_ref: string | null

  // ✅ Opção A: vem da própria tabela controls
  control_owner_name: string | null
  control_owner_email: string | null
  focal_point_name: string | null
  focal_point_email: string | null

  // ✅ NOVO (status do controle no mês, baseado no pior auto_status dos KPIs)
  control_result: string | null // ok | warning | gap | no-data
}

export type FetchControlsInput = {
  q?: string
  limit?: number
  offset?: number

  mes_ref?: string // YYYY-MM (dropdown)
  framework?: string
  frequency?: string
  risk?: string
  owner?: string // nome OU email
  focal?: string // nome OU email
}

// =============================
// FILTER OPTIONS (dropdowns)
// =============================

export async function fetchControlsFilterOptions(): Promise<{
  months: string[]
  frameworks: string[]
  frequencies: string[]
  risks: string[]
  owners: { name: string; email: string }[]
  focals: { name: string; email: string }[]
}> {
  const ctx = await getContext()

  const [months, fw, fr, rk, owners, focals] = await Promise.all([
    // ✅ meses reais vêm das execuções (period_start)
    sql<{ v: string }>`
      SELECT DISTINCT to_char(date_trunc('month', ke.period_start)::date, 'YYYY-MM') AS v
      FROM kpi_executions ke
      WHERE ke.tenant_id = ${ctx.tenantId}
        AND ke.period_start IS NOT NULL
      ORDER BY v DESC
    `,
    sql<{ name: string }>`
      SELECT DISTINCT f.name
      FROM frameworks f
      WHERE f.tenant_id = ${ctx.tenantId}
        AND f.name IS NOT NULL
        AND btrim(f.name) <> ''
      ORDER BY f.name
    `,
    sql<{ v: string }>`
      SELECT DISTINCT c.frequency::text AS v
      FROM controls c
      WHERE c.tenant_id = ${ctx.tenantId}
        AND c.frequency IS NOT NULL
      ORDER BY v
    `,
    sql<{ v: string }>`
      SELECT DISTINCT r.classification::text AS v
      FROM controls c
      LEFT JOIN risk_catalog r ON r.id = c.risk_id
      WHERE c.tenant_id = ${ctx.tenantId}
        AND r.classification IS NOT NULL
      ORDER BY v
    `,
    sql<{ name: string; email: string }>`
      SELECT DISTINCT
        COALESCE(NULLIF(btrim(c.control_owner_name), ''), '—')::text AS name,
        COALESCE(NULLIF(btrim(c.control_owner_email), ''), '—')::text AS email
      FROM controls c
      WHERE c.tenant_id = ${ctx.tenantId}
        AND (
          COALESCE(NULLIF(btrim(c.control_owner_name), ''), NULL) IS NOT NULL
          OR COALESCE(NULLIF(btrim(c.control_owner_email), ''), NULL) IS NOT NULL
        )
      ORDER BY name, email
    `,
    sql<{ name: string; email: string }>`
      SELECT DISTINCT
        COALESCE(NULLIF(btrim(c.focal_point_name), ''), '—')::text AS name,
        COALESCE(NULLIF(btrim(c.focal_point_email), ''), '—')::text AS email
      FROM controls c
      WHERE c.tenant_id = ${ctx.tenantId}
        AND (
          COALESCE(NULLIF(btrim(c.focal_point_name), ''), NULL) IS NOT NULL
          OR COALESCE(NULLIF(btrim(c.focal_point_email), ''), NULL) IS NOT NULL
        )
      ORDER BY name, email
    `,
  ])

  return {
    months: months.rows.map((r) => r.v),
    frameworks: fw.rows.map((r) => r.name),
    frequencies: fr.rows.map((r) => r.v),
    risks: rk.rows.map((r) => r.v),
    owners: owners.rows
      .filter((r) => r.name !== "—" || r.email !== "—")
      .map((r) => ({ name: r.name, email: r.email })),
    focals: focals.rows
      .filter((r) => r.name !== "—" || r.email !== "—")
      .map((r) => ({ name: r.name, email: r.email })),
  }
}

// =============================
// LISTAGEM / FILTROS (ETAPA 2)
// - mes_ref agora controla o "mês do cálculo do status"
// - control_result = pior auto_status entre os KPIs do controle no mês
// =============================

export async function fetchControlsPage(
  input: FetchControlsInput = {}
): Promise<{ rows: ControlRow[]; total: number }> {
  const ctx = await getContext()

  const qRaw = (input.q ?? "").trim()
  const q = qRaw.length ? `%${qRaw}%` : null

  // ✅ mes_ref serve para calcular status do mês (execuções)
  const mes_ref = (input.mes_ref ?? "").trim() // YYYY-MM
  const framework = (input.framework ?? "").trim()
  const frequency = (input.frequency ?? "").trim()
  const risk = (input.risk ?? "").trim()
  const owner = (input.owner ?? "").trim()
  const focal = (input.focal ?? "").trim()

  const limit = Math.max(1, Math.min(100, input.limit ?? 10))
  const offset = Math.max(0, input.offset ?? 0)

  // total (mes_ref NÃO filtra controls; apenas afeta cálculo de resultado)
  const totalRes = await sql<{ total: number }>`
    SELECT COUNT(*)::int AS total
    FROM controls c
    LEFT JOIN frameworks f ON f.id = c.framework_id
    LEFT JOIN risk_catalog r ON r.id = c.risk_id
    WHERE c.tenant_id = ${ctx.tenantId}

      AND (
        ${q}::text IS NULL
        OR c.name ILIKE ${q}
        OR c.control_code ILIKE ${q}
        OR COALESCE(f.name, '') ILIKE ${q}
        OR COALESCE(c.control_owner_name, '') ILIKE ${q}
        OR COALESCE(c.control_owner_email, '') ILIKE ${q}
        OR COALESCE(c.focal_point_name, '') ILIKE ${q}
        OR COALESCE(c.focal_point_email, '') ILIKE ${q}
      )

      AND (${framework} = '' OR COALESCE(f.name, '') = ${framework})
      AND (${frequency} = '' OR COALESCE(c.frequency::text, '') = ${frequency})
      AND (${risk} = '' OR COALESCE(r.classification::text, '') = ${risk})

      AND (
        ${owner} = ''
        OR lower(COALESCE(c.control_owner_email::text, '')) = lower(${owner})
        OR lower(COALESCE(c.control_owner_name::text, '')) = lower(${owner})
      )

      AND (
        ${focal} = ''
        OR lower(COALESCE(c.focal_point_email::text, '')) = lower(${focal})
        OR lower(COALESCE(c.focal_point_name::text, '')) = lower(${focal})
      )
  `
  const total = totalRes.rows?.[0]?.total ?? 0

  // page
  const pageRes = await sql<ControlRow>`
    WITH selected_month AS (
      SELECT
        CASE
          WHEN ${mes_ref} = '' THEN date_trunc('month', now())::date
          ELSE to_date(${mes_ref} || '-01', 'YYYY-MM-DD')
        END AS m
    ),
    latest_exec_in_month AS (
      -- pega a ÚLTIMA execução de cada KPI dentro do mês selecionado
      SELECT DISTINCT ON (ke.kpi_id)
        ke.kpi_id,
        ke.auto_status::text AS auto_status
      FROM kpi_executions ke
      CROSS JOIN selected_month sm
      WHERE ke.tenant_id = ${ctx.tenantId}
        AND ke.period_start IS NOT NULL
        AND date_trunc('month', ke.period_start)::date = sm.m
      ORDER BY ke.kpi_id, ke.period_start DESC, ke.created_at DESC
    ),
    control_worst AS (
      SELECT
        c.id AS control_id,
        MAX(
          CASE
            -- ✅ ajuste aqui se seu enum tiver outros valores
            WHEN lower(COALESCE(le.auto_status, '')) IN ('red', 'gap', 'critical', 'high', 'fail', 'failed', 'ineffective', 'inefetivo') THEN 3
            WHEN lower(COALESCE(le.auto_status, '')) IN ('yellow', 'warning', 'warn', 'medium', 'moderate') THEN 2
            WHEN lower(COALESCE(le.auto_status, '')) IN ('green', 'ok', 'pass', 'passed', 'success', 'effective', 'efetivo') THEN 1
            ELSE 0
          END
        ) AS worst_sev
      FROM controls c
      LEFT JOIN kpis k ON k.control_id = c.id AND k.tenant_id = ${ctx.tenantId}
      LEFT JOIN latest_exec_in_month le ON le.kpi_id = k.id
      WHERE c.tenant_id = ${ctx.tenantId}
      GROUP BY c.id
    )
    SELECT
      c.id,
      c.control_code,
      c.name,
      f.name::text AS framework,
      c.frequency::text AS frequency,
      r.classification::text AS risk_level,
      c.created_at::text AS created_at,

      -- mes_ref que o front selecionou (ou mês atual)
      (SELECT to_char(m, 'YYYY-MM') FROM selected_month)::text AS mes_ref,

      c.control_owner_name::text  AS control_owner_name,
      c.control_owner_email::text AS control_owner_email,
      c.focal_point_name::text    AS focal_point_name,
      c.focal_point_email::text   AS focal_point_email,

      CASE
        WHEN cw.worst_sev = 3 THEN 'gap'
        WHEN cw.worst_sev = 2 THEN 'warning'
        WHEN cw.worst_sev = 1 THEN 'ok'
        ELSE 'no-data'
      END::text AS control_result

    FROM controls c
    LEFT JOIN frameworks f ON f.id = c.framework_id
    LEFT JOIN risk_catalog r ON r.id = c.risk_id
    LEFT JOIN control_worst cw ON cw.control_id = c.id

    WHERE c.tenant_id = ${ctx.tenantId}

      AND (
        ${q}::text IS NULL
        OR c.name ILIKE ${q}
        OR c.control_code ILIKE ${q}
        OR COALESCE(f.name, '') ILIKE ${q}
        OR COALESCE(c.control_owner_name, '') ILIKE ${q}
        OR COALESCE(c.control_owner_email, '') ILIKE ${q}
        OR COALESCE(c.focal_point_name, '') ILIKE ${q}
        OR COALESCE(c.focal_point_email, '') ILIKE ${q}
      )

      AND (${framework} = '' OR COALESCE(f.name, '') = ${framework})
      AND (${frequency} = '' OR COALESCE(c.frequency::text, '') = ${frequency})
      AND (${risk} = '' OR COALESCE(r.classification::text, '') = ${risk})

      AND (
        ${owner} = ''
        OR lower(COALESCE(c.control_owner_email::text, '')) = lower(${owner})
        OR lower(COALESCE(c.control_owner_name::text, '')) = lower(${owner})
      )

      AND (
        ${focal} = ''
        OR lower(COALESCE(c.focal_point_email::text, '')) = lower(${focal})
        OR lower(COALESCE(c.focal_point_name::text, '')) = lower(${focal})
      )

    ORDER BY c.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  return { rows: pageRes.rows, total }
}

// =============================
// IMPORT COMPLETO (Opção A)
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
  control_owner_name?: string
  focal_point_email?: string
  focal_point_name?: string

  // ✅ NOVO (opcional): se no futuro você quiser importar por CSV
  mes_ref?: string // YYYY-MM

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

const RISK_CLASS_MAP: Record<string, "critical" | "high" | "medium" | "low"> = {
  critico: "critical",
  crítico: "critical",
  critica: "critical",
  crítica: "critical",
  critical: "critical",
  crit: "critical",
  alto: "high",
  high: "high",
  medio: "medium",
  médio: "medium",
  moderado: "medium",
  moderate: "medium",
  med: "medium",
  medium: "medium",
  baixo: "low",
  low: "low",
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
function pickRiskClass(v?: string) {
  const s = normLower(v)
  return RISK_CLASS_MAP[s] ?? "medium"
}
function pickType(v?: string) {
  const s = normLower(v)
  return TYPE_MAP[s] ?? null
}

function pickMesRefDate(v?: string | undefined | null): string | null {
  const s = norm(v)
  if (!s) return null
  if (!/^\d{4}-\d{2}$/.test(s)) return null
  return `${s}-01`
}

async function resolveOrCreateFrameworkId(frameworkNameRaw: string, tenantId: string, cache: Map<string, string>) {
  const frameworkName = norm(frameworkNameRaw)
  const key = frameworkName.toLowerCase()
  if (!frameworkName) throw new Error("Framework ausente.")

  const cached = cache.get(key)
  if (cached) return cached

  const found = await sql<{ id: string }>`
    SELECT id FROM frameworks
    WHERE tenant_id = ${tenantId}
      AND lower(name) = lower(${frameworkName})
    LIMIT 1
  `
  let id = found.rows?.[0]?.id

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
    WHERE tenant_id = ${tenantId}
      AND lower(risk_code) = lower(${riskCode})
    LIMIT 1
  `
  let id = existing.rows?.[0]?.id

  const title = norm(row.risk_name) || null
  const description = norm(row.risk_description) || norm(row.risk_name) || "—"
  const classification = pickRiskClass(row.risk_classification)

  if (id) {
    await sql`
      UPDATE risk_catalog
      SET
        title = ${title},
        description = ${description},
        classification = ${classification},
        updated_at = now()
      WHERE id = ${id}
        AND tenant_id = ${tenantId}
    `
  } else {
    const ins = await sql<{ id: string }>`
      INSERT INTO risk_catalog (tenant_id, risk_code, title, description, classification)
      VALUES (${tenantId}, ${riskCode}, ${title}, ${description}, ${classification})
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
    const code = norm(r.control_code)
    if (!code) return
    const key = code.toLowerCase()
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
      const risk_id = await resolveOrCreateRiskId(r0, tenantId, riskCache)

      const name = norm(r0.control_name)
      if (!name) throw new Error("control_name ausente.")

      const description = norm(r0.control_description) || null
      const status = pickControlStatus(r0.control_status)
      const frequency = pickFrequency(r0.control_frequency)
      const type = pickType(r0.control_type)

      const control_owner_email = norm(r0.control_owner_email) || null
      const control_owner_name = norm(r0.control_owner_name) || null
      const focal_point_email = norm(r0.focal_point_email) || null
      const focal_point_name = norm(r0.focal_point_name) || null

      const mesRefIso = pickMesRefDate(r0.mes_ref) // "YYYY-MM-01" ou null

      const existing = await sql<{ id: string }>`
        SELECT id
        FROM controls
        WHERE tenant_id = ${tenantId}
          AND control_code = ${control_code}
        LIMIT 1
      `
      let controlId = existing.rows?.[0]?.id

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
            type = ${type},

            control_owner_email = ${control_owner_email},
            control_owner_name = ${control_owner_name},
            focal_point_email = ${focal_point_email},
            focal_point_name = ${focal_point_name},

            mes_ref = COALESCE(to_date(${mesRefIso}::text, 'YYYY-MM-DD'), mes_ref),

            updated_at = now()
          WHERE id = ${controlId}
            AND tenant_id = ${tenantId}
        `
        controls_updated++
      } else {
        const ins = await sql<{ id: string }>`
          INSERT INTO controls (
            tenant_id, control_code, name, description,
            framework_id, risk_id, frequency, status, type,
            control_owner_email, control_owner_name,
            focal_point_email, focal_point_name,
            mes_ref
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
            ${type},
            ${control_owner_email},
            ${control_owner_name},
            ${focal_point_email},
            ${focal_point_name},
            COALESCE(to_date(${mesRefIso}::text, 'YYYY-MM-DD'), date_trunc('month', now())::date)
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
          SELECT id
          FROM kpis
          WHERE tenant_id = ${tenantId}
            AND kpi_code = ${kpi_code}
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
            WHERE id = ${existingKpiId}
              AND tenant_id = ${tenantId}
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
