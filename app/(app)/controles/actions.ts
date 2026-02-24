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

  control_owner_name: string | null
  control_owner_email: string | null
  focal_point_name: string | null
  focal_point_email: string | null

  /**
   * ✅ status do controle no mês (agregado pelos KPIs aplicáveis)
   * critical | warning | overdue | pending | effective | not_applicable
   */
  control_result: string | null

  // ✅ contadores de KPIs associados ao controle (no mês)
  kpi_total: number
  kpi_red: number
  kpi_yellow: number
  kpi_green: number
}

export type FetchControlsInput = {
  q?: string
  limit?: number
  offset?: number

  mes_ref?: string // YYYY-MM (dropdown)
  framework?: string
  frequency?: string
  risk?: string
  owner?: string
  focal?: string
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
    sql<{ v: string }>`
      SELECT to_char(d::date, 'YYYY-MM') AS v
      FROM generate_series(
        date '2026-01-01',
        date '2027-12-01',
        interval '1 month'
      ) AS d
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
// LISTAGEM / FILTROS
// =============================

export async function fetchControlsPage(
  input: FetchControlsInput = {}
): Promise<{ rows: ControlRow[]; total: number }> {
  const ctx = await getContext()

  const qRaw = (input.q ?? "").trim()
  const q = qRaw.length ? `%${qRaw}%` : null

  const mes_ref = (input.mes_ref ?? "").trim() // YYYY-MM
  const framework = (input.framework ?? "").trim()
  const frequency = (input.frequency ?? "").trim()
  const risk = (input.risk ?? "").trim()
  const owner = (input.owner ?? "").trim()
  const focal = (input.focal ?? "").trim()

  const limit = Math.max(1, Math.min(100, input.limit ?? 10))
  const offset = Math.max(0, input.offset ?? 0)

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

  const pageRes = await sql<ControlRow>`
    WITH selected_month AS (
      SELECT
        CASE
          WHEN ${mes_ref} = '' THEN date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date
          ELSE to_date(${mes_ref} || '-01', 'YYYY-MM-DD')
        END AS m
    ),
    current_month AS (
      SELECT date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date AS cm
    ),
    latest_exec_in_month AS (
      -- última execução por KPI no mês selecionado
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

    kpi_month_status AS (
      SELECT
        c.id AS control_id,
        k.id AS kpi_id,

        -- ✅ aplicabilidade por frequência (agora com daily/weekly/monthly/on_demand)
        CASE
          WHEN lower(COALESCE(c.frequency::text,'')) IN ('daily','weekly','monthly','on_demand') THEN true
          WHEN lower(COALESCE(c.frequency::text,'')) IN ('quarterly') THEN (EXTRACT(MONTH FROM sm.m)::int IN (1,4,7,11))
          WHEN lower(COALESCE(c.frequency::text,'')) IN ('semiannual') THEN (EXTRACT(MONTH FROM sm.m)::int IN (1,7))
          WHEN lower(COALESCE(c.frequency::text,'')) IN ('annual') THEN (EXTRACT(MONTH FROM sm.m)::int IN (10,11,12))
          ELSE true
        END AS is_applicable,

        le.auto_status::text AS db_status,

        -- status final do KPI (green/yellow/red/pending/overdue/not_applicable)
        CASE
          WHEN NOT (
            CASE
              WHEN lower(COALESCE(c.frequency::text,'')) IN ('daily','weekly','monthly','on_demand') THEN true
              WHEN lower(COALESCE(c.frequency::text,'')) IN ('quarterly') THEN (EXTRACT(MONTH FROM sm.m)::int IN (1,4,7,11))
              WHEN lower(COALESCE(c.frequency::text,'')) IN ('semiannual') THEN (EXTRACT(MONTH FROM sm.m)::int IN (1,7))
              WHEN lower(COALESCE(c.frequency::text,'')) IN ('annual') THEN (EXTRACT(MONTH FROM sm.m)::int IN (10,11,12))
              ELSE true
            END
          ) THEN 'not_applicable'

          WHEN le.kpi_id IS NULL THEN
            CASE
              WHEN sm.m < cm.cm THEN 'overdue'
              ELSE 'pending'
            END

          ELSE
            CASE lower(COALESCE(le.auto_status,''))
              WHEN 'in_target' THEN 'green'
              WHEN 'warning' THEN 'yellow'
              WHEN 'out_of_target' THEN 'red'
              WHEN 'not_applicable' THEN 'not_applicable'
              ELSE 'pending'
            END
        END::text AS kpi_status

      FROM controls c
      LEFT JOIN kpis k ON k.control_id = c.id AND k.tenant_id = ${ctx.tenantId}
      LEFT JOIN latest_exec_in_month le ON le.kpi_id = k.id
      CROSS JOIN selected_month sm
      CROSS JOIN current_month cm
      WHERE c.tenant_id = ${ctx.tenantId}
    ),

    control_worst AS (
      SELECT
        c.id AS control_id,

        -- ✅ mês aplicável para o controle (mesma regra acima)
        CASE
          WHEN lower(COALESCE(c.frequency::text,'')) IN ('daily','weekly','monthly','on_demand') THEN true
          WHEN lower(COALESCE(c.frequency::text,'')) IN ('quarterly') THEN (EXTRACT(MONTH FROM sm.m)::int IN (1,4,7,11))
          WHEN lower(COALESCE(c.frequency::text,'')) IN ('semiannual') THEN (EXTRACT(MONTH FROM sm.m)::int IN (1,7))
          WHEN lower(COALESCE(c.frequency::text,'')) IN ('annual') THEN (EXTRACT(MONTH FROM sm.m)::int IN (10,11,12))
          ELSE true
        END AS month_applicable,

        MAX(
          CASE kms.kpi_status
            WHEN 'red' THEN 5
            WHEN 'yellow' THEN 4
            WHEN 'overdue' THEN 3
            WHEN 'pending' THEN 2
            WHEN 'green' THEN 1
            ELSE 0
          END
        )::int AS worst_sev
      FROM controls c
      CROSS JOIN selected_month sm
      LEFT JOIN kpi_month_status kms ON kms.control_id = c.id
      WHERE c.tenant_id = ${ctx.tenantId}
      GROUP BY c.id, month_applicable
    ),

    control_counts AS (
      SELECT
        c.id AS control_id,
        COUNT(k.id)::int AS kpi_total,
        SUM(CASE WHEN kms.kpi_status = 'red' THEN 1 ELSE 0 END)::int AS kpi_red,
        SUM(CASE WHEN kms.kpi_status = 'yellow' THEN 1 ELSE 0 END)::int AS kpi_yellow,
        SUM(CASE WHEN kms.kpi_status = 'green' THEN 1 ELSE 0 END)::int AS kpi_green
      FROM controls c
      LEFT JOIN kpis k ON k.control_id = c.id AND k.tenant_id = ${ctx.tenantId}
      LEFT JOIN kpi_month_status kms ON kms.kpi_id = k.id
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

      (SELECT to_char(m, 'YYYY-MM') FROM selected_month)::text AS mes_ref,

      c.control_owner_name::text  AS control_owner_name,
      c.control_owner_email::text AS control_owner_email,
      c.focal_point_name::text    AS focal_point_name,
      c.focal_point_email::text   AS focal_point_email,

      CASE
        WHEN cw.month_applicable = false THEN 'not_applicable'
        WHEN cw.worst_sev = 5 THEN 'critical'
        WHEN cw.worst_sev = 4 THEN 'warning'
        WHEN cw.worst_sev = 3 THEN 'overdue'
        WHEN cw.worst_sev = 2 THEN 'pending'
        WHEN cw.worst_sev = 1 THEN 'effective'
        ELSE 'pending'
      END::text AS control_result,

      COALESCE(cc.kpi_total, 0)::int AS kpi_total,
      COALESCE(cc.kpi_red, 0)::int AS kpi_red,
      COALESCE(cc.kpi_yellow, 0)::int AS kpi_yellow,
      COALESCE(cc.kpi_green, 0)::int AS kpi_green

    FROM controls c
    LEFT JOIN frameworks f ON f.id = c.framework_id
    LEFT JOIN risk_catalog r ON r.id = c.risk_id
    LEFT JOIN control_worst cw ON cw.control_id = c.id
    LEFT JOIN control_counts cc ON cc.control_id = c.id

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

// =====================================================
// ✅ IMPORTAÇÃO COMPLETA (controles + riscos + KPIs)
// =====================================================

type ImportRow = {
  framework: string
  control_code: string
  control_name: string
  control_description?: string
  control_goal?: string
  control_status?: string
  control_frequency?: string
  control_type?: string

  control_owner_email?: string
  control_owner_name?: string
  focal_point_email?: string
  focal_point_name?: string

  risk_code?: string
  risk_name?: string
  risk_description?: string
  risk_classification?: string

  kpi_code?: string
  kpi_name?: string
  kpi_description?: string

  // compat antigo (se o usuário só preencher isso)
  kpi_target?: string | number

  // novos campos KPI
  kpi_type?: string // percent | number | boolean
  kpi_target_operator?: string // gte | lte | eq (ou >= <= =)
  kpi_target_value?: string | number
  kpi_target_boolean?: string // true/false/sim/nao/1/0
  kpi_warning_buffer_pct?: string | number // ex: 5
}

function _norm(v: any) {
  return String(v ?? "").trim()
}

function emptyToNull(v: any) {
  const s = _norm(v)
  return s ? s : null
}

function parseNumberOrNull(v: any) {
  const s = _norm(v)
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parseBoolOrNull(v: any) {
  const s = _norm(v).toLowerCase()
  if (!s) return null
  if (["true", "1", "sim", "yes", "y"].includes(s)) return true
  if (["false", "0", "nao", "não", "no", "n"].includes(s)) return false
  return null
}

function normalizeKpiType(v: any): "percent" | "number" | "boolean" | null {
  const s = _norm(v).toLowerCase()
  if (!s) return null
  if (["percent", "percentage", "%", "porcentagem"].includes(s)) return "percent"
  if (["number", "numeric", "numerico", "numérico"].includes(s)) return "number"
  if (["boolean", "bool", "sim/nao", "sim-nao", "yes/no", "yesno"].includes(s)) return "boolean"
  return null
}

function normalizeRiskClassification(v: any): "low" | "medium" | "high" | "critical" | null {
  const s0 = _norm(v)
  if (!s0) return null

  const s = s0.toLowerCase()

  if (["crítico", "critico", "crítica", "critica", "crit"].includes(s)) return "critical"
  if (["alto", "alta"].includes(s)) return "high"
  if (["médio", "medio", "moderado", "moderada", "med", "medium"].includes(s)) return "medium"
  if (["baixo", "baixa", "low"].includes(s)) return "low"

  if (["critical", "high", "medium", "low"].includes(s)) return s as any

  if (s === "4") return "critical"
  if (s === "3") return "high"
  if (s === "2") return "medium"
  if (s === "1") return "low"

  throw new Error(`risk_classification inválido: "${s0}"`)
}

function normalizeControlStatus(v: any): "active" | "archived" | null {
  const s0 = _norm(v)
  if (!s0) return null
  const s = s0.toLowerCase()

  if (["ativo", "ativa", "act"].includes(s)) return "active"
  if (["arquivado", "arquivada", "archived"].includes(s)) return "archived"
  if (["active", "archived"].includes(s)) return s as any

  throw new Error(`control_status inválido: "${s0}"`)
}

function normalizeControlFrequency(
  v: any
): "daily" | "weekly" | "monthly" | "quarterly" | "semiannual" | "annual" | "on_demand" | null {
  const s0 = _norm(v)
  if (!s0) return null
  const s = s0.toLowerCase().trim()

  // pt-br (labels do seu select)
  if (["diária", "diaria", "dia", "daily"].includes(s)) return "daily"
  if (["semanal", "semana", "weekly"].includes(s)) return "weekly"
  if (["mensal", "mês", "mes", "monthly", "month"].includes(s)) return "monthly"
  if (["trimestral", "trimestre", "quarterly", "quarter"].includes(s)) return "quarterly"

  // semestral + aliases
  if (
    ["semestral", "semestre", "semiannual", "half-year", "halfyear", "biannual", "bianual", "semi-annual"].includes(s)
  )
    return "semiannual"

  if (["anual", "ano", "annual", "yearly"].includes(s)) return "annual"

  // sob demanda
  if (["sob demanda", "sob-demanda", "sob_demanda", "ondemand", "on demand", "on_demand", "ad hoc", "adhoc"].includes(s))
    return "on_demand"

  // numérico
  if (s === "365") return "daily"
  if (s === "52") return "weekly"
  if (s === "12") return "monthly"
  if (s === "4") return "quarterly"
  if (s === "2") return "semiannual"
  if (s === "1") return "annual"
  if (s === "0") return "on_demand"

  throw new Error(`control_frequency inválido: "${s0}"`)
}

function normalizeOperator(v: any): "gte" | "lte" | "eq" | null {
  const s = _norm(v).toLowerCase()
  if (!s) return null
  if (s === "gte" || s === ">=") return "gte"
  if (s === "lte" || s === "<=") return "lte"
  if (s === "eq" || s === "=") return "eq"
  return null
}

function parseWarningPctToDb(v: any) {
  const n = parseNumberOrNull(v)
  if (n === null) return null
  const pct = n / 100
  if (!Number.isFinite(pct)) return null
  return Math.min(Math.max(pct, 0), 0.5)
}

export async function importarControlesCompleto(rows: ImportRow[]) {
  const ctx = await getContext()

  let controls_imported = 0
  let controls_updated = 0
  let kpis_imported = 0
  let kpis_updated = 0

  const errors: any[] = []
  const validRows: { line: number; r: ImportRow }[] = []

  for (let i = 0; i < rows.length; i++) {
    const line = i + 2
    const r = rows[i]

    try {
      const frameworkName = _norm(r.framework)
      const control_code = _norm(r.control_code)
      const control_name = _norm(r.control_name)

      if (!frameworkName || !control_code || !control_name) {
        throw new Error("Campos obrigatórios ausentes: framework, control_code, control_name")
      }

      if (emptyToNull(r.control_status)) normalizeControlStatus(r.control_status)
      if (emptyToNull(r.control_frequency)) normalizeControlFrequency(r.control_frequency)
      if (emptyToNull(r.risk_classification)) normalizeRiskClassification(r.risk_classification)

      if (emptyToNull(r.kpi_type)) {
        const kt = normalizeKpiType(r.kpi_type)
        if (!kt) throw new Error(`kpi_type inválido: "${_norm(r.kpi_type)}"`)
      }

      if (emptyToNull(r.kpi_target_operator)) {
        const op = normalizeOperator(r.kpi_target_operator)
        if (!op) throw new Error(`kpi_target_operator inválido: "${_norm(r.kpi_target_operator)}"`)
      }

      validRows.push({ line, r })
    } catch (e: any) {
      errors.push({
        line,
        control_code: rows[i]?.control_code,
        kpi_code: rows[i]?.kpi_code,
        message: e?.message || String(e),
      })
    }
  }

  if (errors.length) {
    return { controls_imported, controls_updated, kpis_imported, kpis_updated, errors }
  }

  for (const item of validRows) {
    const r = item.r
    const line = item.line

    try {
      const frameworkName = _norm(r.framework)
      const control_code = _norm(r.control_code)
      const control_name = _norm(r.control_name)

      const fwRes = await sql<{ id: string }>`
        INSERT INTO frameworks (tenant_id, name, created_at)
        VALUES (${ctx.tenantId}, ${frameworkName}, now())
        ON CONFLICT (tenant_id, name)
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id::text AS id
      `
      const framework_id = fwRes.rows?.[0]?.id
      if (!framework_id) throw new Error("Falha ao resolver framework_id.")

      let risk_id: string | null = null
      const risk_code = emptyToNull(r.risk_code)
      if (risk_code) {
        const riskRes = await sql<{ id: string }>`
          INSERT INTO risk_catalog (
            tenant_id, risk_code, title, description, classification, source, natureza, created_at
          )
          VALUES (
            ${ctx.tenantId},
            ${risk_code},
            ${emptyToNull(r.risk_name)},
            ${emptyToNull(r.risk_description)},
            ${normalizeRiskClassification(r.risk_classification)},
            NULL,
            NULL,
            now()
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
        risk_id = riskRes.rows?.[0]?.id ?? null
      }

      const ctlExists = await sql<{ id: string }>`
        SELECT id::text AS id
        FROM controls
        WHERE tenant_id = ${ctx.tenantId}
          AND control_code = ${control_code}
        LIMIT 1
      `
      const existingControlId = ctlExists.rows?.[0]?.id ?? null

      const ctlUp = await sql<{ id: string }>`
        INSERT INTO controls (
          tenant_id,
          framework_id,
          risk_id,
          control_code,
          name,
          description,
          goal,
          status,
          frequency,
          control_type,
          control_owner_email,
          control_owner_name,
          focal_point_email,
          focal_point_name,
          created_at,
          updated_at
        )
        VALUES (
          ${ctx.tenantId},
          ${framework_id}::uuid,
          ${risk_id ? (risk_id as any) : null}::uuid,
          ${control_code},
          ${control_name},
          ${emptyToNull(r.control_description)},
          ${emptyToNull(r.control_goal)},
          ${normalizeControlStatus(r.control_status)}::control_status,
          ${normalizeControlFrequency(r.control_frequency)}::control_frequency,
          ${emptyToNull(r.control_type)},
          ${emptyToNull(r.control_owner_email)},
          ${emptyToNull(r.control_owner_name)},
          ${emptyToNull(r.focal_point_email)},
          ${emptyToNull(r.focal_point_name)},
          now(),
          now()
        )
        ON CONFLICT (tenant_id, control_code)
        DO UPDATE SET
          framework_id = EXCLUDED.framework_id,
          risk_id = COALESCE(EXCLUDED.risk_id, controls.risk_id),
          name = EXCLUDED.name,
          description = COALESCE(EXCLUDED.description, controls.description),
          goal = COALESCE(EXCLUDED.goal, controls.goal),
          status = COALESCE(EXCLUDED.status, controls.status),
          frequency = COALESCE(EXCLUDED.frequency, controls.frequency),
          control_type = COALESCE(EXCLUDED.control_type, controls.control_type),
          control_owner_email = COALESCE(EXCLUDED.control_owner_email, controls.control_owner_email),
          control_owner_name  = COALESCE(EXCLUDED.control_owner_name,  controls.control_owner_name),
          focal_point_email   = COALESCE(EXCLUDED.focal_point_email,   controls.focal_point_email),
          focal_point_name    = COALESCE(EXCLUDED.focal_point_name,    controls.focal_point_name),
          updated_at = now()
        RETURNING id::text AS id
      `
      const control_id = ctlUp.rows?.[0]?.id
      if (!control_id) throw new Error("Falha ao criar/atualizar controle.")

      if (existingControlId) controls_updated++
      else controls_imported++

      const kpi_code = emptyToNull(r.kpi_code)
      if (kpi_code) {
        const kpi_name = emptyToNull(r.kpi_name)
        if (!kpi_name) throw new Error("kpi_name é obrigatório quando kpi_code é informado.")

        const existsKpi = await sql<{ id: string }>`
          SELECT id::text AS id
          FROM kpis
          WHERE tenant_id = ${ctx.tenantId}
            AND kpi_code = ${kpi_code}
          LIMIT 1
        `
        const existingKpiId = existsKpi.rows?.[0]?.id ?? null

        const kpi_type = normalizeKpiType(r.kpi_type) ?? null
        const target_operator = normalizeOperator(r.kpi_target_operator) ?? null

        const target_value_raw = (r.kpi_target_value ?? r.kpi_target) as any
        const target_value_num = parseNumberOrNull(target_value_raw)

        const target_boolean = parseBoolOrNull(r.kpi_target_boolean)
        const warning_buffer_pct = parseWarningPctToDb(r.kpi_warning_buffer_pct)

        let target_value_db: number | null = target_value_num
        if (kpi_type === "boolean") {
          if (typeof target_boolean === "boolean") target_value_db = target_boolean ? 1 : 0
          else if (target_value_num === 0 || target_value_num === 1) target_value_db = target_value_num
          else target_value_db = null
        }

        const upKpi = await sql<{ id: string }>`
          INSERT INTO kpis (
            tenant_id,
            control_id,
            kpi_code,
            kpi_name,
            kpi_description,
            kpi_type,
            target_operator,
            target_value,
            warning_buffer_pct,
            created_at,
            updated_at
          )
          VALUES (
            ${ctx.tenantId},
            ${control_id}::uuid,
            ${kpi_code},
            ${kpi_name},
            ${emptyToNull(r.kpi_description)},
            ${kpi_type},
            ${target_operator},
            ${target_value_db},
            ${warning_buffer_pct ?? 0.05},
            now(),
            now()
          )
          ON CONFLICT (tenant_id, kpi_code)
          DO UPDATE SET
            control_id = EXCLUDED.control_id,
            kpi_name = EXCLUDED.kpi_name,
            kpi_description = COALESCE(EXCLUDED.kpi_description, kpis.kpi_description),
            kpi_type = COALESCE(EXCLUDED.kpi_type, kpis.kpi_type),
            target_operator = COALESCE(EXCLUDED.target_operator, kpis.target_operator),
            target_value = COALESCE(EXCLUDED.target_value, kpis.target_value),
            warning_buffer_pct = COALESCE(EXCLUDED.warning_buffer_pct, kpis.warning_buffer_pct),
            updated_at = now()
          RETURNING id::text AS id
        `
        const kpi_id = upKpi.rows?.[0]?.id
        if (!kpi_id) throw new Error("Falha ao criar/atualizar KPI.")

        if (existingKpiId) kpis_updated++
        else kpis_imported++
      }
    } catch (e: any) {
      errors.push({
        line,
        control_code: r?.control_code,
        kpi_code: r?.kpi_code,
        message: e?.message || String(e),
      })
    }
  }

  return { controls_imported, controls_updated, kpis_imported, kpis_updated, errors }
}
