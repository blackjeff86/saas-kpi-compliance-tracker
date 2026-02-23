"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"
import { revalidatePath } from "next/cache"

export type KpiListRow = {
  id: string
  kpi_code: string
  kpi_name: string
  kpi_type: string | null
  target_operator: string | null
  target_value: number | null
  evidence_required: boolean | null
  is_active: boolean
  created_at: string

  /**
   * ✅ status do KPI no mês selecionado (igual a lógica do detalhe do Controle):
   * green | yellow | red | pending | overdue | not_applicable
   */
  month_status: string | null

  // ✅ valor inserido na última execução do mês (kpi_executions.result_numeric)
  month_result_numeric: number | null
  mes_ref_used: string

  // ✅ dados do controle associado (via k.control_id -> controls)
  framework: string | null
  frequency: string | null
  control_owner_name: string | null
  control_owner_email: string | null
  focal_point_name: string | null
  focal_point_email: string | null

  // ✅ data da próxima execução (calculada pela frequência do controle)
  next_execution_date: string | null
}

export async function fetchKpisFilterOptions(): Promise<{
  months: string[]
  frameworks: string[]
  frequencies: string[]
  owners: { name: string; email: string }[]
  focals: { name: string; email: string }[]
}> {
  const ctx = await getContext()

  const [months, fw, fr, owners, focals] = await Promise.all([
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
      JOIN controls c ON c.framework_id = f.id
      JOIN kpis k ON k.control_id = c.id
      WHERE k.tenant_id = ${ctx.tenantId}
        AND f.name IS NOT NULL
        AND btrim(f.name) <> ''
      ORDER BY f.name
    `,
    sql<{ v: string }>`
      SELECT DISTINCT c.frequency::text AS v
      FROM controls c
      JOIN kpis k ON k.control_id = c.id
      WHERE k.tenant_id = ${ctx.tenantId}
        AND c.frequency IS NOT NULL
      ORDER BY v
    `,
    sql<{ name: string; email: string }>`
      SELECT DISTINCT
        COALESCE(NULLIF(btrim(c.control_owner_name), ''), '—')::text AS name,
        COALESCE(NULLIF(btrim(c.control_owner_email), ''), '—')::text AS email
      FROM controls c
      JOIN kpis k ON k.control_id = c.id
      WHERE k.tenant_id = ${ctx.tenantId}
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
      JOIN kpis k ON k.control_id = c.id
      WHERE k.tenant_id = ${ctx.tenantId}
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
    owners: owners.rows
      .filter((r) => r.name !== "—" || r.email !== "—")
      .map((r) => ({ name: r.name, email: r.email })),
    focals: focals.rows
      .filter((r) => r.name !== "—" || r.email !== "—")
      .map((r) => ({ name: r.name, email: r.email })),
  }
}

export type FetchKpisInput = {
  mes_ref?: string
  q?: string
  framework?: string
  frequency?: string
  owner?: string
  focal?: string
  resultado?: string
  limit?: number
  offset?: number
}

export async function fetchKpis(input: FetchKpisInput = {}): Promise<{ rows: KpiListRow[]; total: number }> {
  const ctx = await getContext()
  const mes_ref = String(input?.mes_ref ?? "").trim()
  const qRaw = (input?.q ?? "").trim()
  const q = qRaw.length ? `%${qRaw}%` : null
  const framework = String(input?.framework ?? "").trim()
  const frequency = String(input?.frequency ?? "").trim()
  const owner = String(input?.owner ?? "").trim()
  const focal = String(input?.focal ?? "").trim()
  const resultado = String(input?.resultado ?? "").trim()
  const limit = Math.max(1, Math.min(100, input?.limit ?? 10))
  const offset = Math.max(0, input?.offset ?? 0)

  const { rows } = await sql<KpiListRow>`
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
    today_br AS (
      SELECT
        EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int AS y,
        EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int AS m
    ),
    latest_exec_in_month AS (
      SELECT DISTINCT ON (ke.kpi_id)
        ke.kpi_id,
        lower(ke.auto_status::text) AS auto_status,
        ke.result_numeric,
        ke.period_start
      FROM kpi_executions ke
      CROSS JOIN selected_month sm
      WHERE ke.tenant_id = ${ctx.tenantId}
        AND ke.period_start IS NOT NULL
        AND date_trunc('month', ke.period_start)::date = sm.m
      ORDER BY ke.kpi_id, ke.period_start DESC, ke.created_at DESC
    )
    SELECT
      k.id::text AS id,
      k.kpi_code::text AS kpi_code,
      k.kpi_name::text AS kpi_name,
      k.kpi_type::text AS kpi_type,

      COALESCE(k.is_active, true)::boolean AS is_active,

      CASE WHEN COALESCE(k.is_active, true) THEN k.target_operator::text ELSE NULL END AS target_operator,
      CASE WHEN COALESCE(k.is_active, true) THEN k.target_value ELSE NULL END AS target_value,

      k.evidence_required AS evidence_required,
      k.created_at::text AS created_at,

      (
        CASE
          -- aplicabilidade por frequência do controle (mesma regra de Controles/detalhe)
          WHEN (
            CASE
              WHEN lower(COALESCE(c.frequency::text,'')) IN ('daily','weekly','monthly','on_demand') THEN true
              WHEN lower(COALESCE(c.frequency::text,'')) = 'quarterly' THEN (EXTRACT(MONTH FROM sm.m)::int IN (1,4,7,11))
              WHEN lower(COALESCE(c.frequency::text,'')) = 'semiannual' THEN (EXTRACT(MONTH FROM sm.m)::int IN (1,7))
              WHEN lower(COALESCE(c.frequency::text,'')) IN ('annual','yearly') THEN (EXTRACT(MONTH FROM sm.m)::int IN (10,11,12))
              ELSE true
            END
          ) = false THEN 'not_applicable'

          WHEN le.kpi_id IS NULL THEN
            CASE
              WHEN sm.m < cm.cm THEN 'overdue'
              ELSE 'pending'
            END

          ELSE
            CASE COALESCE(le.auto_status,'')
              WHEN 'in_target' THEN 'green'
              WHEN 'warning' THEN 'yellow'
              WHEN 'out_of_target' THEN 'red'
              WHEN 'not_applicable' THEN 'not_applicable'
              ELSE 'pending'
            END
        END
      )::text AS month_status,
      le.result_numeric AS month_result_numeric,
      (SELECT to_char(m, 'YYYY-MM') FROM selected_month)::text AS mes_ref_used,

      f.name::text AS framework,
      c.frequency::text AS frequency,
      c.control_owner_name::text AS control_owner_name,
      c.control_owner_email::text AS control_owner_email,
      c.focal_point_name::text AS focal_point_name,
      c.focal_point_email::text AS focal_point_email,

      to_char(
        CASE lower(COALESCE(c.frequency::text,''))
          WHEN 'daily' THEN (date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date + interval '1 month')::date
          WHEN 'weekly' THEN (date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date + interval '1 month')::date
          WHEN 'monthly' THEN (date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date + interval '1 month')::date
          WHEN 'on_demand' THEN NULL::date
          WHEN 'quarterly' THEN
            (SELECT CASE
              WHEN tb.m < 4 THEN make_date(tb.y, 4, 1)
              WHEN tb.m < 7 THEN make_date(tb.y, 7, 1)
              WHEN tb.m < 11 THEN make_date(tb.y, 11, 1)
              ELSE make_date(tb.y + 1, 1, 1)
            END FROM today_br tb)
          WHEN 'semiannual' THEN
            (SELECT CASE WHEN tb.m < 7 THEN make_date(tb.y, 7, 1) ELSE make_date(tb.y + 1, 1, 1) END FROM today_br tb)
          WHEN 'annual' THEN
            (SELECT CASE WHEN tb.m < 10 THEN make_date(tb.y, 10, 1) ELSE make_date(tb.y + 1, 10, 1) END FROM today_br tb)
          ELSE (date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date + interval '1 month')::date
        END,
        'DD/MM/YYYY'
      ) AS next_execution_date

    FROM kpis k
    JOIN controls c ON c.id = k.control_id AND c.tenant_id = ${ctx.tenantId}
    LEFT JOIN frameworks f ON f.id = c.framework_id
    LEFT JOIN latest_exec_in_month le ON le.kpi_id = k.id
    CROSS JOIN selected_month sm
    CROSS JOIN current_month cm
    WHERE k.tenant_id = ${ctx.tenantId}

      AND (
        ${q}::text IS NULL
        OR k.kpi_code::text ILIKE ${q}
        OR k.kpi_name::text ILIKE ${q}
        OR COALESCE(f.name, '') ILIKE ${q}
        OR COALESCE(c.control_owner_name, '') ILIKE ${q}
        OR COALESCE(c.control_owner_email, '') ILIKE ${q}
        OR COALESCE(c.focal_point_name, '') ILIKE ${q}
        OR COALESCE(c.focal_point_email, '') ILIKE ${q}
      )

      AND (${framework} = '' OR COALESCE(f.name, '') = ${framework})
      AND (${frequency} = '' OR COALESCE(c.frequency::text, '') = ${frequency})
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
    ORDER BY k.created_at DESC
  `
  const filtered =
    resultado === ""
      ? rows
      : rows.filter((r) => (r.month_status ?? "").toLowerCase() === resultado.toLowerCase())
  const total = filtered.length
  const paginatedRows = filtered.slice(offset, offset + limit)
  return { rows: paginatedRows, total }
}

// =============================
// Novo KPI (modal) — controles para select
// =============================

export async function fetchControlsForKpiSelect(): Promise<
  { id: string; control_code: string; name: string }[]
> {
  const ctx = await getContext()
  const { rows } = await sql<{ id: string; control_code: string; name: string }>`
    SELECT c.id::text AS id, c.control_code::text AS control_code, c.name::text AS name
    FROM controls c
    WHERE c.tenant_id = ${ctx.tenantId}
    ORDER BY c.control_code ASC
  `
  return rows
}

// =============================
// Criar KPI (usado pelo NewKpiModal)
// =============================

function norm(v: unknown) {
  return String(v ?? "").trim()
}

export async function createKpi(
  formData: FormData
): Promise<{ ok: boolean; error?: string; kpiId?: string; controlId?: string }> {
  const ctx = await getContext()

  const controlId = norm(formData.get("controlId"))
  const kpiCode = norm(formData.get("kpiCode"))
  const kpiName = norm(formData.get("kpiName"))
  const kpiDescription = norm(formData.get("kpiDescription"))

  if (!controlId) return { ok: false, error: "Selecione um controle." }
  if (!kpiCode) return { ok: false, error: "Código do KPI é obrigatório." }
  if (!kpiName) return { ok: false, error: "Nome do KPI é obrigatório." }

  try {
    const chk = await sql<{ id: string }>`
      SELECT c.id::text AS id
      FROM controls c
      WHERE c.tenant_id = ${ctx.tenantId}
        AND c.id = ${controlId}::uuid
      LIMIT 1
    `
    if (!chk.rows[0]?.id) return { ok: false, error: "Controle não existe ou não pertence ao tenant." }

    const ins = await sql<{ id: string }>`
      INSERT INTO kpis (
        tenant_id,
        control_id,
        kpi_code,
        kpi_name,
        kpi_description,
        is_active
      ) VALUES (
        ${ctx.tenantId}::uuid,
        ${controlId}::uuid,
        ${kpiCode},
        ${kpiName},
        ${kpiDescription || null},
        true
      )
      RETURNING id::text AS id
    `
    const kpiId = ins.rows[0]?.id
    if (!kpiId) return { ok: false, error: "Falha ao criar KPI." }

    revalidatePath("/kpis")
    revalidatePath(`/controles/${controlId}`)
    return { ok: true, kpiId, controlId }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("kpi_code"))
      return { ok: false, error: "Já existe um KPI com este código (kpi_code)." }
    return { ok: false, error: msg }
  }
}
