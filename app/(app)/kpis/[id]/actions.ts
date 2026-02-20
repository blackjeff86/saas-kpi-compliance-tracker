// app/(app)/kpis/[id]/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../../lib/context"
import { computeAutoStatus } from "../../lib/auto-status"

// =============================
// TYPES
// =============================

export type ControlDetail = {
  id: string
  control_code: string
  name: string
  framework: string | null
  frequency: string | null
  risk_level: string | null
  created_at: string

  description: string | null
  goal: string | null

  control_owner_name: string | null
  control_owner_email: string | null
  focal_point_name: string | null
  focal_point_email: string | null

  risk_id: string | null
  risk_name: string | null
  risk_description: string | null
}

export type ControlKpiSummaryRow = {
  kpi_id: string
  kpi_code: string
  kpi_name: string

  is_active: boolean

  target_operator: string | null
  target_value: number | null

  period_result: number | null

  period_auto_status: string | null
  period_end: string | null
}

export type ActionPlanRow = {
  id: string
  title: string
  priority: string
  status: string
  due_date: string | null
  created_at: string
}

export type ControlHistoryRow = {
  kind: "execution" | "action_plan"
  title: string
  subtitle: string
  happened_at: string
}

// =============================
// HELPERS
// =============================

function norm(v: any) {
  return String(v ?? "").trim()
}

function toSelectedMonthDate(mes_ref?: string | null) {
  const mr = norm(mes_ref)
  if (!mr) return null
  if (!/^\d{4}-\d{2}$/.test(mr)) return null
  return mr
}

// ✅ Sem coluna target_boolean no banco:
// - boolean target fica em target_value (1/0)
// - convertemos aqui quando necessário
function boolFromTargetValue(v: any): boolean | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n === 1) return true
  if (n === 0) return false
  return null
}

function targetValueFromBool(b: boolean | null): number | null {
  if (typeof b !== "boolean") return null
  return b ? 1 : 0
}

// ✅ NOVO: para KPI boolean, inferir result_boolean a partir do result_numeric (1/0)
function boolFromResultNumeric(v: number | null | undefined): boolean | null {
  if (v === null || v === undefined) return null
  if (!Number.isFinite(v)) return null
  if (v === 1) return true
  if (v === 0) return false
  return null
}

function safeJsonParse<T = any>(s?: string | null): T | null {
  if (!s) return null
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

export async function fetchControlMonthsOptions(): Promise<string[]> {
  const { rows } = await sql<{ v: string }>`
    SELECT to_char(d::date, 'YYYY-MM') AS v
    FROM generate_series(
      date '2026-01-01',
      date '2027-12-01',
      interval '1 month'
    ) AS d
    ORDER BY v DESC
  `
  return rows.map((r) => r.v)
}

// =============================
// DETAIL (control)
// =============================

export async function fetchControlDetail(controlId: string): Promise<ControlDetail | null> {
  const ctx = await getContext()

  const { rows } = await sql<ControlDetail>`
    SELECT
      c.id,
      c.control_code,
      c.name,
      f.name::text AS framework,
      c.frequency::text AS frequency,
      r.classification::text AS risk_level,
      c.created_at::text AS created_at,

      c.description::text AS description,
      c.goal::text        AS goal,

      c.control_owner_name::text  AS control_owner_name,
      c.control_owner_email::text AS control_owner_email,
      c.focal_point_name::text    AS focal_point_name,
      c.focal_point_email::text   AS focal_point_email,

      r.risk_code::text     AS risk_id,
      r.title::text         AS risk_name,
      r.description::text   AS risk_description
    FROM controls c
    LEFT JOIN frameworks f ON f.id = c.framework_id
    LEFT JOIN risk_catalog r ON r.id = c.risk_id
    WHERE c.tenant_id = ${ctx.tenantId}
      AND c.id = ${controlId}
    LIMIT 1
  `

  return rows[0] ?? null
}

// =============================
// KPIs (por mês selecionado)
// =============================

export async function fetchKpisForControl(controlId: string, mes_ref?: string | null): Promise<ControlKpiSummaryRow[]> {
  const ctx = await getContext()
  const mr = toSelectedMonthDate(mes_ref) ?? "" // YYYY-MM

  const { rows } = await sql<ControlKpiSummaryRow>`
    WITH selected_month AS (
      SELECT
        CASE
          WHEN ${mr} = '' THEN date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date
          ELSE to_date(${mr} || '-01', 'YYYY-MM-DD')
        END AS m
    ),
    current_month AS (
      SELECT date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date AS cm
    ),
    latest_exec_in_month AS (
      SELECT DISTINCT ON (ke.kpi_id)
        ke.kpi_id,
        ke.result_numeric,
        lower(ke.auto_status::text) AS auto_status,
        ke.period_end::text  AS period_end,
        ke.period_start
      FROM kpi_executions ke
      CROSS JOIN selected_month sm
      WHERE ke.tenant_id = ${ctx.tenantId}
        AND ke.control_id = ${controlId}
        AND ke.period_start IS NOT NULL
        AND date_trunc('month', ke.period_start)::date = sm.m
      ORDER BY ke.kpi_id, ke.period_start DESC, ke.created_at DESC
    )
    SELECT
      k.id::text AS kpi_id,
      k.kpi_code::text AS kpi_code,
      k.kpi_name::text AS kpi_name,

      COALESCE(k.is_active, true)::boolean AS is_active,

      CASE WHEN COALESCE(k.is_active, true) THEN k.target_operator::text ELSE NULL END AS target_operator,
      CASE WHEN COALESCE(k.is_active, true) THEN k.target_value ELSE NULL END AS target_value,

      le.result_numeric AS period_result,

      (
        CASE
          WHEN (
            CASE
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
      )::text AS period_auto_status,

      le.period_end::text AS period_end

    FROM kpis k
    JOIN controls c ON c.id = k.control_id AND c.tenant_id = ${ctx.tenantId}
    CROSS JOIN selected_month sm
    CROSS JOIN current_month cm
    LEFT JOIN latest_exec_in_month le ON le.kpi_id = k.id
    WHERE k.tenant_id = ${ctx.tenantId}
      AND k.control_id = ${controlId}
    ORDER BY k.kpi_code ASC, k.kpi_name ASC
  `
  return rows
}

// =============================
// CONTROL aggregated status
// =============================

export async function fetchControlPeriodStatus(controlId: string, mes_ref?: string | null): Promise<{
  mes_ref_used: string
  control_period_status: "critical" | "warning" | "overdue" | "pending" | "effective" | "not_applicable"
}> {
  const ctx = await getContext()
  const mr = toSelectedMonthDate(mes_ref) ?? ""

  const { rows } = await sql<{
    mes_ref_used: string
    month_applicable: boolean
    worst_sev: number
  }>`
    WITH selected_month AS (
      SELECT
        CASE
          WHEN ${mr} = '' THEN date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date
          ELSE to_date(${mr} || '-01', 'YYYY-MM-DD')
        END AS m
    ),
    current_month AS (
      SELECT date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date AS cm
    ),
    month_applicability AS (
      SELECT
        c.id AS control_id,
        (
          CASE
            WHEN lower(COALESCE(c.frequency::text,'')) = 'quarterly' THEN (EXTRACT(MONTH FROM sm.m)::int IN (1,4,7,11))
            WHEN lower(COALESCE(c.frequency::text,'')) = 'semiannual' THEN (EXTRACT(MONTH FROM sm.m)::int IN (1,7))
            WHEN lower(COALESCE(c.frequency::text,'')) IN ('annual','yearly') THEN (EXTRACT(MONTH FROM sm.m)::int IN (10,11,12))
            ELSE true
          END
        ) AS month_applicable
      FROM controls c
      CROSS JOIN selected_month sm
      WHERE c.tenant_id = ${ctx.tenantId}
        AND c.id = ${controlId}
      LIMIT 1
    ),
    latest_exec_in_month AS (
      SELECT DISTINCT ON (ke.kpi_id)
        ke.kpi_id,
        lower(ke.auto_status::text) AS auto_status
      FROM kpi_executions ke
      CROSS JOIN selected_month sm
      WHERE ke.tenant_id = ${ctx.tenantId}
        AND ke.control_id = ${controlId}
        AND ke.period_start IS NOT NULL
        AND date_trunc('month', ke.period_start)::date = sm.m
      ORDER BY ke.kpi_id, ke.period_start DESC, ke.created_at DESC
    ),
    kpi_status AS (
      SELECT
        k.id AS kpi_id,
        CASE
          WHEN ma.month_applicable = false THEN 'not_applicable'
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
        END AS s
      FROM kpis k
      CROSS JOIN selected_month sm
      CROSS JOIN current_month cm
      CROSS JOIN month_applicability ma
      LEFT JOIN latest_exec_in_month le ON le.kpi_id = k.id
      WHERE k.tenant_id = ${ctx.tenantId}
        AND k.control_id = ${controlId}
    )
    SELECT
      (SELECT to_char(m, 'YYYY-MM') FROM selected_month)::text AS mes_ref_used,
      (SELECT month_applicable FROM month_applicability)::boolean AS month_applicable,
      MAX(
        CASE s
          WHEN 'red' THEN 5
          WHEN 'yellow' THEN 4
          WHEN 'overdue' THEN 3
          WHEN 'pending' THEN 2
          WHEN 'green' THEN 1
          ELSE 0
        END
      )::int AS worst_sev
    FROM kpi_status
  `

  const mes_ref_used = rows?.[0]?.mes_ref_used ?? ""
  const applicable = rows?.[0]?.month_applicable ?? true
  const worst = rows?.[0]?.worst_sev ?? 0

  if (!applicable) {
    return { mes_ref_used, control_period_status: "not_applicable" }
  }

  const control_period_status =
    worst === 5 ? "critical" :
    worst === 4 ? "warning" :
    worst === 3 ? "overdue" :
    worst === 2 ? "pending" :
    worst === 1 ? "effective" :
    "pending"

  return { mes_ref_used, control_period_status }
}

// =============================
// COMBINED
// =============================

export async function fetchControlById(controlId: string, mes_ref?: string | null) {
  const [control, months, kpis, period] = await Promise.all([
    fetchControlDetail(controlId),
    fetchControlMonthsOptions(),
    fetchKpisForControl(controlId, mes_ref),
    fetchControlPeriodStatus(controlId, mes_ref),
  ])

  if (!control) throw new Error("Controle não existe ou não pertence ao tenant.")

  return {
    control,
    months,
    kpis,
    mes_ref_used: period.mes_ref_used,
    control_period_status: period.control_period_status,
  }
}

// =============================
// KPI DETAIL PAGE (kpis/[id])
// =============================

export type KpiDetail = {
  kpi_id: string
  kpi_code: string
  kpi_name: string
  kpi_description: string | null

  control_id: string
  control_code: string
  control_frequency: string | null

  is_active: boolean

  kpi_type: string | null
  target_operator: string | null
  target_value: number | null
  target_boolean: boolean | null
  warning_buffer_pct: number | null
}

export type KpiExecutionForMonth = {
  execution_id: string | null
  kpi_id: string
  mes_ref: string // YYYY-MM
  result_numeric: number | null
  result_notes: string | null
  auto_status: string | null
  created_at: string | null
  updated_at: string | null
}

export type KpiHistoryRow = {
  execution_id: string
  kpi_id: string
  period_start: string // YYYY-MM
  result_numeric: number | null
  result_notes: string | null
  auto_status: string | null
  created_at: string | null
}

/**
 * ✅ Busca dados do KPI + execução do mês + histórico (últimas 5)
 */
export async function fetchKpiExecutionPage(kpiId: string, mes_ref: string) {
  const ctx = await getContext()
  const tenantId = (ctx as any).tenantId ?? (ctx as any).tenant_id ?? (ctx as any).tenantId

  if (!tenantId) throw new Error("Tenant não encontrado no contexto.")
  if (!kpiId) throw new Error("KPI inválido.")
  if (!/^\d{4}-\d{2}$/.test(mes_ref)) throw new Error("mes_ref inválido. Use YYYY-MM.")

  // 1) KPI + Controle (+ novos campos)
  const kpiRes = await sql<{
    kpi_id: string
    kpi_code: string
    kpi_name: string
    kpi_description: string | null
    control_id: string
    control_code: string
    control_frequency: string | null

    is_active: boolean | null

    kpi_type: string | null
    target_operator: string | null
    target_value: any
    warning_buffer_pct: number | null
  }>`
    SELECT
      k.id::text AS kpi_id,
      k.kpi_code::text AS kpi_code,
      k.kpi_name::text AS kpi_name,
      k.kpi_description::text AS kpi_description,

      c.id::text AS control_id,
      c.control_code::text AS control_code,
      c.frequency::text AS control_frequency,

      COALESCE(k.is_active, true)::boolean AS is_active,

      k.kpi_type::text AS kpi_type,

      CASE WHEN COALESCE(k.is_active, true) THEN k.target_operator::text ELSE NULL END AS target_operator,
      CASE WHEN COALESCE(k.is_active, true) THEN k.target_value ELSE NULL END AS target_value,

      k.warning_buffer_pct AS warning_buffer_pct
    FROM kpis k
    JOIN controls c ON c.id = k.control_id
    WHERE k.tenant_id = ${tenantId}
      AND k.id = ${kpiId}
    LIMIT 1
  `

  const r0 = kpiRes.rows?.[0]
  if (!r0) throw new Error("KPI não existe ou não pertence ao tenant.")

  const tvNum =
    r0.target_value === null || r0.target_value === undefined ? null : Number(r0.target_value)

  const isActive = Boolean(r0.is_active)

  const kpi: KpiDetail = {
    kpi_id: r0.kpi_id,
    kpi_code: r0.kpi_code ?? "",
    kpi_name: r0.kpi_name ?? "",
    kpi_description: r0.kpi_description ?? null,

    control_id: r0.control_id,
    control_code: r0.control_code ?? "",
    control_frequency: r0.control_frequency ?? null,

    is_active: isActive,

    kpi_type: r0.kpi_type ?? null,
    target_operator: r0.target_operator ?? null,
    target_value: tvNum,
    target_boolean: (r0.kpi_type ?? "").toLowerCase() === "boolean" ? boolFromTargetValue(tvNum) : null,
    warning_buffer_pct:
      typeof r0.warning_buffer_pct === "number" && Number.isFinite(r0.warning_buffer_pct)
        ? r0.warning_buffer_pct
        : null,
  }

  // 2) Execução do mês
  const execRes = await sql<{
    execution_id: string
    kpi_id: string
    period_start: string | null
    result_numeric: any
    result_notes: string | null
    auto_status: string | null
    created_at: string | null
    updated_at: string | null
  }>`
    WITH selected_month AS (
      SELECT to_date(${mes_ref} || '-01', 'YYYY-MM-DD')::date AS m
    )
    SELECT
      ke.id::text AS execution_id,
      ke.kpi_id::text AS kpi_id,
      ke.period_start::text AS period_start,
      ke.result_numeric AS result_numeric,
      ke.result_notes::text AS result_notes,
      ke.auto_status::text AS auto_status,
      ke.created_at::text AS created_at,
      ke.updated_at::text AS updated_at
    FROM kpi_executions ke
    CROSS JOIN selected_month sm
    WHERE ke.tenant_id = ${tenantId}
      AND ke.kpi_id = ${kpiId}
      AND ke.period_start IS NOT NULL
      AND date_trunc('month', ke.period_start)::date = sm.m
    ORDER BY ke.period_start DESC, ke.created_at DESC
    LIMIT 1
  `

  const e0 = execRes.rows?.[0]
  const execution: KpiExecutionForMonth = e0
    ? {
        execution_id: e0.execution_id ?? null,
        kpi_id: e0.kpi_id ?? kpi.kpi_id,
        mes_ref,
        result_numeric: e0.result_numeric === null || e0.result_numeric === undefined ? null : Number(e0.result_numeric),
        result_notes: e0.result_notes ?? null,
        auto_status: e0.auto_status ? String(e0.auto_status).toLowerCase() : "unknown",
        created_at: e0.created_at ?? null,
        updated_at: e0.updated_at ?? null,
      }
    : {
        execution_id: null,
        kpi_id: kpi.kpi_id,
        mes_ref,
        result_numeric: null,
        result_notes: null,
        auto_status: "unknown",
        created_at: null,
        updated_at: null,
      }

  // 3) Histórico (últimas 5)
  const histRes = await sql<{
    execution_id: string
    kpi_id: string
    period_start: string
    result_numeric: any
    result_notes: string | null
    auto_status: string | null
    created_at: string | null
  }>`
    SELECT
      ke.id::text AS execution_id,
      ke.kpi_id::text AS kpi_id,
      to_char(date_trunc('month', ke.period_start), 'YYYY-MM')::text AS period_start,
      ke.result_numeric AS result_numeric,
      ke.result_notes::text AS result_notes,
      ke.auto_status::text AS auto_status,
      ke.created_at::text AS created_at
    FROM kpi_executions ke
    WHERE ke.tenant_id = ${tenantId}
      AND ke.kpi_id = ${kpiId}
      AND ke.period_start IS NOT NULL
    ORDER BY ke.period_start DESC, ke.created_at DESC
    LIMIT 5
  `

  const history: KpiHistoryRow[] = (histRes.rows ?? []).map((h) => ({
    execution_id: String(h.execution_id),
    kpi_id: String(h.kpi_id),
    period_start: String(h.period_start ?? ""),
    result_numeric: h.result_numeric === null || h.result_numeric === undefined ? null : Number(h.result_numeric),
    result_notes: h.result_notes ?? null,
    auto_status: h.auto_status ? String(h.auto_status).toLowerCase() : null,
    created_at: h.created_at ?? null,
  }))

  return { kpi, execution, history, mes_ref_used: mes_ref }
}

/**
 * ✅ Upsert para o mês (usando period_start = YYYY-MM-01)
 * ✅ FIX: boolean: inferir result_boolean de result_numeric (1/0) quando não vier
 * ✅ FIX: status salvo deve refletir o que foi calculado
 * ✅ NOVO: registra evento em audit_events para aparecer no Histórico do Controle
 */
export async function upsertKpiExecutionForMonth(args: {
  kpiId: string
  mes_ref: string
  result_numeric: number | null
  result_boolean?: boolean | null
  result_notes: string | null
}) {
  const ctx = await getContext()
  const tenantId = (ctx as any).tenantId ?? (ctx as any).tenant_id ?? (ctx as any).tenantId

  if (!tenantId) throw new Error("Tenant não encontrado no contexto.")
  if (!args.kpiId) throw new Error("KPI inválido.")
  if (!/^\d{4}-\d{2}$/.test(args.mes_ref)) throw new Error("mes_ref inválido. Use YYYY-MM.")

  // Puxa meta do KPI para calcular auto_status no backend (inclui buffer)
  const metaRes = await sql<{
    kpi_type: string | null
    target_operator: string | null
    target_value: any
    warning_buffer_pct: number | null
    is_active: boolean | null
  }>`
    SELECT
      k.kpi_type::text AS kpi_type,
      CASE WHEN COALESCE(k.is_active, true) THEN k.target_operator::text ELSE NULL END AS target_operator,
      CASE WHEN COALESCE(k.is_active, true) THEN k.target_value ELSE NULL END AS target_value,
      k.warning_buffer_pct AS warning_buffer_pct,
      COALESCE(k.is_active, true)::boolean AS is_active
    FROM kpis k
    WHERE k.tenant_id = ${tenantId}
      AND k.id = ${args.kpiId}
    LIMIT 1
  `

  const m0 = metaRes.rows?.[0]
  if (!m0) throw new Error("KPI não existe ou não pertence ao tenant.")

  const kpiType = String(m0.kpi_type ?? "").toLowerCase()
  const isBoolean = kpiType === "boolean"

  const target_value =
    m0.target_value === null || m0.target_value === undefined ? null : Number(m0.target_value)

  const buffer =
    typeof m0.warning_buffer_pct === "number" && Number.isFinite(m0.warning_buffer_pct)
      ? m0.warning_buffer_pct
      : 0.05

  const derived_target_boolean = isBoolean ? boolFromTargetValue(target_value) : null

  // ✅ FIX: inferir result_boolean quando KPI é boolean e o client mandou só 1/0 em result_numeric
  const effectiveResultBoolean =
    typeof args.result_boolean === "boolean"
      ? args.result_boolean
      : isBoolean
      ? boolFromResultNumeric(args.result_numeric)
      : null

  const auto_status = computeAutoStatus(
    {
      kpi_type: m0.kpi_type,
      target_operator: m0.target_operator,
      target_value,
      target_boolean: derived_target_boolean,
    } as any,
    {
      result_numeric: args.result_numeric,
      result_boolean: effectiveResultBoolean,
    },
    buffer
  )

  // Busca control_id (schema exige)
  const ctlRes = await sql<{ control_id: string }>`
    SELECT control_id::text AS control_id
    FROM kpis
    WHERE tenant_id = ${tenantId}
      AND id = ${args.kpiId}
    LIMIT 1
  `
  const control_id = ctlRes.rows?.[0]?.control_id
  if (!control_id) throw new Error("Controle do KPI não encontrado.")

  const period_start = `${args.mes_ref}-01`

  // ✅ BEFORE (para auditoria): execução existente no mesmo período
  const beforeRes = await sql<{
    id: string
    result_numeric: any
    result_boolean: boolean | null
    result_notes: string | null
    auto_status: string | null
  }>`
    SELECT
      ke.id::text AS id,
      ke.result_numeric AS result_numeric,
      ke.result_boolean AS result_boolean,
      ke.result_notes::text AS result_notes,
      ke.auto_status::text AS auto_status
    FROM kpi_executions ke
    WHERE ke.tenant_id = ${tenantId}
      AND ke.kpi_id = ${args.kpiId}::uuid
      AND ke.period_start = ${period_start}::date
    LIMIT 1
  `
  const before = beforeRes.rows?.[0]
    ? {
        execution_id: beforeRes.rows[0].id,
        result_numeric:
          beforeRes.rows[0].result_numeric === null || beforeRes.rows[0].result_numeric === undefined
            ? null
            : Number(beforeRes.rows[0].result_numeric),
        result_boolean: beforeRes.rows[0].result_boolean ?? null,
        result_notes: beforeRes.rows[0].result_notes ?? null,
        auto_status: beforeRes.rows[0].auto_status ? String(beforeRes.rows[0].auto_status).toLowerCase() : null,
      }
    : null

  const up = await sql<{ execution_id: string }>`
    INSERT INTO kpi_executions (
      tenant_id, control_id, kpi_id,
      period_start, period_end,
      result_numeric, result_boolean, result_notes, auto_status,
      created_at, updated_at
    )
    VALUES (
      ${tenantId},
      ${control_id}::uuid,
      ${args.kpiId}::uuid,
      ${period_start}::date,
      (date_trunc('month', (${args.mes_ref} || '-01')::date) + interval '1 month' - interval '1 day')::date,
      ${args.result_numeric},
      ${effectiveResultBoolean},
      ${args.result_notes},
      ${auto_status},
      now(),
      now()
    )
    ON CONFLICT (tenant_id, kpi_id, period_start)
    DO UPDATE SET
      result_numeric = EXCLUDED.result_numeric,
      result_boolean = EXCLUDED.result_boolean,
      result_notes   = EXCLUDED.result_notes,
      auto_status    = EXCLUDED.auto_status,
      period_end     = EXCLUDED.period_end,
      updated_at     = now()
    RETURNING id::text AS execution_id
  `

  const executionId = up.rows?.[0]?.execution_id
  if (!executionId) throw new Error("Falha ao salvar execução.")

  // ✅ audit_events: registra “criado vs atualizado” (mesmo período)
  const action = before ? "kpi_execution_updated" : "kpi_execution_created"
  const after = {
    execution_id: executionId,
    mes_ref: args.mes_ref,
    period_start,
    result_numeric: args.result_numeric,
    result_boolean: effectiveResultBoolean,
    result_notes: args.result_notes ?? null,
    auto_status,
  }

  await sql`
    INSERT INTO audit_events (
      tenant_id,
      entity_type,
      entity_id,
      action,
      actor_user_id,
      metadata,
      created_at
    )
    VALUES (
      ${ctx.tenantId}::uuid,
      'kpi',
      ${args.kpiId}::uuid,
      ${action},
      NULL,
      ${JSON.stringify({ before, after })}::jsonb,
      now()
    )
  `

  return { executionId }
}

/**
 * ✅ Etapa 2: salvar configuração do KPI
 * ✅ Sem coluna target_boolean: salvamos boolean em target_value (1/0)
 * ✅ Registra evento em audit_events
 */
export async function updateKpiConfig(args: {
  kpiId: string
  kpi_type: "percent" | "number" | "boolean"
  target_operator: "gte" | "lte" | "eq"
  target_value: number | null
  target_boolean: boolean | null
  warning_buffer_pct: number // 0.00 a 0.50
}) {
  const ctx = await getContext()

  if (!args.kpiId) throw new Error("KPI inválido.")
  if (args.warning_buffer_pct < 0 || args.warning_buffer_pct > 0.5) {
    throw new Error("Faixa de warning inválida (0% a 50%).")
  }

  if (args.kpi_type === "boolean") {
    if (typeof args.target_boolean !== "boolean") throw new Error("Meta (Sim/Não) é obrigatória.")
  } else {
    if (typeof args.target_value !== "number" || Number.isNaN(args.target_value)) {
      throw new Error("Meta numérica é obrigatória.")
    }
  }

  const dbTargetValue =
    args.kpi_type === "boolean" ? targetValueFromBool(args.target_boolean) : args.target_value

  const beforeRes = await sql<{
    kpi_type: string | null
    target_operator: string | null
    target_value: any
    warning_buffer_pct: number | null
  }>`
    SELECT
      k.kpi_type::text AS kpi_type,
      k.target_operator::text AS target_operator,
      k.target_value AS target_value,
      k.warning_buffer_pct AS warning_buffer_pct
    FROM kpis k
    WHERE k.tenant_id = ${ctx.tenantId}
      AND k.id = ${args.kpiId}::uuid
    LIMIT 1
  `
  const before = beforeRes.rows?.[0] ?? null

  await sql`
    UPDATE kpis
    SET
      kpi_type = ${args.kpi_type},
      target_operator = ${args.target_operator},
      target_value = ${dbTargetValue},
      warning_buffer_pct = ${args.warning_buffer_pct},
      updated_at = now()
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${args.kpiId}::uuid
  `

  await sql`
    INSERT INTO audit_events (
      tenant_id,
      entity_type,
      entity_id,
      action,
      actor_user_id,
      metadata,
      created_at
    )
    VALUES (
      ${ctx.tenantId}::uuid,
      'kpi',
      ${args.kpiId}::uuid,
      'kpi_config_updated',
      NULL,
      ${JSON.stringify({
        before,
        after: {
          kpi_type: args.kpi_type,
          target_operator: args.target_operator,
          target_value: dbTargetValue,
          warning_buffer_pct: args.warning_buffer_pct,
        },
      })}::jsonb,
      now()
    )
  `

  return { ok: true }
}

// =============================
// ✅ NOVO: ACTION PLAN (para KPI abaixo da meta)
// =============================

export type CreateActionPlanForKpiInput = {
  execution_id: string | null
  control_id: string
  kpi_id: string

  title: string
  description: string | null
  responsible: string | null

  due_date: string // YYYY-MM-DD
  priority: "low" | "medium" | "high" | "critical"
}

/**
 * ✅ Cria um plano de ação vinculado ao KPI / execução do mês.
 */
export async function createActionPlanForKpi(input: CreateActionPlanForKpiInput) {
  const ctx = await getContext()
  const tenantId = (ctx as any).tenantId ?? (ctx as any).tenant_id ?? (ctx as any).tenantId

  if (!tenantId) throw new Error("Tenant não encontrado no contexto.")
  if (!input?.control_id) throw new Error("control_id é obrigatório.")
  if (!input?.kpi_id) throw new Error("kpi_id é obrigatório.")
  if (!norm(input?.title)) throw new Error("Título do plano de ação é obrigatório.")
  if (!norm(input?.due_date)) throw new Error("Data estimada de conclusão é obrigatória.")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(norm(input.due_date))) {
    throw new Error("due_date inválido. Use YYYY-MM-DD.")
  }

  const responsible = norm(input?.responsible) || null
  let ownerUserId: string | null = null

  if (responsible) {
    const byEmail = await sql<{ id: string }>`
      SELECT id::text AS id
      FROM users
      WHERE tenant_id = ${tenantId}
        AND lower(email::text) = lower(${responsible})
      LIMIT 1
    `
    if (byEmail.rows?.[0]?.id) {
      ownerUserId = byEmail.rows[0].id
    } else {
      const byName = await sql<{ id: string }>`
        SELECT id::text AS id
        FROM users
        WHERE tenant_id = ${tenantId}
          AND lower(name::text) = lower(${responsible})
        ORDER BY created_at DESC
        LIMIT 2
      `
      if (byName.rows.length === 1) {
        ownerUserId = byName.rows[0].id
      }
    }
  }

  // garante que control/kpi pertencem ao tenant (defensivo)
  const guard = await sql<{ ok: number }>`
    SELECT 1 AS ok
    FROM kpis k
    JOIN controls c ON c.id = k.control_id
    WHERE k.tenant_id = ${tenantId}
      AND c.tenant_id = ${tenantId}
      AND k.id = ${input.kpi_id}::uuid
      AND c.id = ${input.control_id}::uuid
    LIMIT 1
  `
  if (!guard.rows?.[0]?.ok) {
    throw new Error("KPI/Controle inválido ou não pertence ao tenant.")
  }

  const ins = await sql<{ id: string }>`
    INSERT INTO action_plans (
      tenant_id,
      execution_id,
      control_id,
      kpi_id,
      title,
      description,
      responsible_name,
      owner_user_id,
      due_date,
      priority,
      status,
      created_at,
      updated_at
    )
    VALUES (
      ${tenantId}::uuid,
      ${input.execution_id ? (input.execution_id as any) : null}::uuid,
      ${input.control_id}::uuid,
      ${input.kpi_id}::uuid,
      ${input.title},
      ${input.description},
      ${responsible},
      ${ownerUserId ? ownerUserId : null}::uuid,
      ${input.due_date}::date,
      ${input.priority}::action_priority,
      'not_started'::action_status,
      now(),
      now()
    )
    RETURNING id::text AS id
  `

  const actionPlanId = ins.rows?.[0]?.id
  if (!actionPlanId) throw new Error("Falha ao criar plano de ação.")

  // audit_events (mantendo padrão)
  await sql`
    INSERT INTO audit_events (
      tenant_id,
      entity_type,
      entity_id,
      action,
      actor_user_id,
      metadata,
      created_at
    )
    VALUES (
      ${tenantId}::uuid,
      'action_plan',
      ${actionPlanId}::uuid,
      'action_plan_created',
      NULL,
      ${JSON.stringify({
        linked: {
          execution_id: input.execution_id,
          control_id: input.control_id,
          kpi_id: input.kpi_id,
        },
        fields: {
          title: input.title,
          responsible: responsible,
          responsible_name: responsible,
          owner_user_id: ownerUserId,
          due_date: input.due_date,
          priority: input.priority,
        },
      })}::jsonb,
      now()
    )
  `

  return { id: actionPlanId }
}
