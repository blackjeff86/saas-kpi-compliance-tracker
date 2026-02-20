// app/(app)/controles/novo/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../../lib/context"

export type FrameworkOption = { name: string }
export type UserOption = { name: string; email: string }

export async function fetchFrameworkOptions(): Promise<FrameworkOption[]> {
  const ctx = await getContext()

  const r = await sql<{ name: string }>`
    SELECT name
    FROM frameworks
    WHERE tenant_id = ${ctx.tenantId}::uuid
    ORDER BY name ASC
  `
  return r.rows.map((x) => ({ name: x.name }))
}

export async function fetchUserOptions(): Promise<UserOption[]> {
  const ctx = await getContext()

  const r = await sql<{ name: string; email: string }>`
    SELECT name, email
    FROM users
    WHERE tenant_id = ${ctx.tenantId}::uuid
    ORDER BY name ASC
  `
  return r.rows
}

/**
 * ✅ Agora suporta excluir o próprio controle no modo edição
 */
export async function checkControlCodeAvailability(controlCode: string, excludeControlId?: string) {
  const ctx = await getContext()
  const code = String(controlCode || "").trim()
  const excludeId = String(excludeControlId || "").trim()

  if (!code) return { ok: true as const, available: true as const }

  const r = await sql<{ id: string }>`
    SELECT id
    FROM controls
    WHERE tenant_id = ${ctx.tenantId}::uuid
      AND control_code = ${code}
      AND (${excludeId} = '' OR id <> ${excludeId}::uuid)
    LIMIT 1
  `
  return { ok: true as const, available: r.rowCount === 0 }
}

type KPIInput = {
  kpi_code: string
  kpi_name: string
  kpi_description: string
  kpi_type: string // "number" | "percent" | "boolean"
  kpi_target_operator: string // "gte" | "lte" | "eq"
  kpi_target_value: number | null // boolean vira 1/0 aqui
  kpi_warning_buffer_pct: number | null // 5 => 0.05
}

export type CreateControlInput = {
  framework: string
  control_code: string
  control_name: string
  control_description: string
  control_goal: string
  control_status: string
  control_frequency: string
  control_type: string

  control_owner_email: string
  control_owner_name: string
  focal_point_email: string
  focal_point_name: string

  risk_code: string
  risk_name: string
  risk_description: string
  risk_classification: string // low|medium|high|critical

  kpis: KPIInput[]
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

  if (["ativo", "ativa", "act", "active"].includes(s)) return "active"
  if (["arquivado", "arquivada", "archived"].includes(s)) return "archived"

  throw new Error(`control_status inválido: "${s0}"`)
}

/**
 * ✅ Compat DB enum: daily | weekly | monthly | quarterly | semiannual | annual | on_demand
 * ✅ Aceita também valores do UX legado: biannual, adhoc
 */
function normalizeControlFrequency(
  v: any
): "daily" | "weekly" | "monthly" | "quarterly" | "semiannual" | "annual" | "on_demand" | null {
  const s0 = _norm(v)
  if (!s0) return null
  const s = s0.toLowerCase()

  // pt-br / ux
  if (["diária", "diaria", "daily", "day"].includes(s)) return "daily"
  if (["semanal", "weekly", "week"].includes(s)) return "weekly"
  if (["mensal", "mês", "mes", "monthly", "month"].includes(s)) return "monthly"
  if (["trimestral", "trimestre", "quarterly", "quarter"].includes(s)) return "quarterly"

  // semestral / biannual
  if (["semestral", "semiannual", "half-year", "halfyear", "biannual", "bianual", "semi-annual"].includes(s))
    return "semiannual"

  if (["anual", "annual", "yearly"].includes(s)) return "annual"

  // sob demanda / adhoc
  if (["sob demanda", "sob_demanda", "on_demand", "ondemand", "ad hoc", "adhoc"].includes(s)) return "on_demand"

  // numérico
  if (s === "365") return "daily"
  if (s === "52") return "weekly"
  if (s === "12") return "monthly"
  if (s === "4") return "quarterly"
  if (s === "2") return "semiannual"
  if (s === "1") return "annual"

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

function normalizeKpiType(v: any): "percent" | "number" | "boolean" | null {
  const s = _norm(v).toLowerCase()
  if (!s) return null
  if (["percent", "percentage", "%", "porcentagem"].includes(s)) return "percent"
  if (["number", "numeric", "numerico", "numérico"].includes(s)) return "number"
  if (["boolean", "bool", "sim/nao", "sim-nao", "yes/no", "yesno"].includes(s)) return "boolean"
  return null
}

// 5 => 0.05 (salva no DB)
function parseWarningPctToDb(v: any) {
  const n = parseNumberOrNull(v)
  if (n === null) return null
  const pct = n / 100
  if (!Number.isFinite(pct)) return null
  return Math.min(Math.max(pct, 0), 0.5)
}

/**
 * ✅ Sem auth/sessão: actor_user_id deve ser NULL.
 */
async function resolveActorUserId(_ctx: any): Promise<string | null> {
  return null
}

type ExistingKpiRow = {
  id: string
  control_id: string
  kpi_name: string | null
  kpi_description: string | null
  kpi_type: string | null
  target_operator: string | null
  target_value: number | null
  warning_buffer_pct: number | null
}

async function fetchExistingKpiByCode(ctx: any, kpi_code: string): Promise<ExistingKpiRow | null> {
  const r = await sql<ExistingKpiRow>`
    SELECT
      id::text AS id,
      control_id::text AS control_id,
      kpi_name::text AS kpi_name,
      kpi_description::text AS kpi_description,
      kpi_type::text AS kpi_type,
      target_operator::text AS target_operator,
      target_value::float8 AS target_value,
      warning_buffer_pct::float8 AS warning_buffer_pct
    FROM kpis
    WHERE tenant_id = ${ctx.tenantId}::uuid
      AND kpi_code = ${kpi_code}
    LIMIT 1
  `
  return r.rows?.[0] ?? null
}

function sameNullable(a: any, b: any) {
  const aa = a ?? null
  const bb = b ?? null

  // número: compara com tolerância
  const aNum = typeof aa === "number" ? aa : aa !== null && aa !== "" && !Number.isNaN(Number(aa)) ? Number(aa) : null
  const bNum = typeof bb === "number" ? bb : bb !== null && bb !== "" && !Number.isNaN(Number(bb)) ? Number(bb) : null
  if (aNum !== null && bNum !== null) {
    return Math.abs(aNum - bNum) < 1e-9
  }

  return String(aa) === String(bb)
}

function buildKpiBeforeAfter(existingKpi: ExistingKpiRow | null, next: any) {
  const before = existingKpi
    ? {
        control_id: existingKpi.control_id ?? null,
        kpi_name: existingKpi.kpi_name ?? null,
        kpi_description: existingKpi.kpi_description ?? null,
        kpi_type: existingKpi.kpi_type ?? null,
        target_operator: existingKpi.target_operator ?? null,
        target_value: existingKpi.target_value ?? null,
        warning_buffer_pct: existingKpi.warning_buffer_pct ?? null,
      }
    : null

  const after = {
    control_id: next.control_id ?? null,
    kpi_name: next.kpi_name ?? null,
    kpi_description: next.kpi_description ?? null,
    kpi_type: next.kpi_type ?? null,
    target_operator: next.target_operator ?? null,
    target_value: next.target_value ?? null,
    warning_buffer_pct: next.warning_buffer_pct ?? null,
  }

  const changes: Record<string, { from: any; to: any }> = {}
  function add(key: string, from: any, to: any) {
    const f = from ?? null
    const t = to ?? null
    if (!sameNullable(f, t)) changes[key] = { from: f, to: t }
  }

  add("control_id", before?.control_id ?? null, after.control_id)
  add("kpi_name", before?.kpi_name ?? null, after.kpi_name)
  add("kpi_description", before?.kpi_description ?? null, after.kpi_description)
  add("kpi_type", before?.kpi_type ?? null, after.kpi_type)
  add("target_operator", before?.target_operator ?? null, after.target_operator)
  add("target_value", before?.target_value ?? null, after.target_value)
  add("warning_buffer_pct", before?.warning_buffer_pct ?? null, after.warning_buffer_pct)

  return { before, after, changes }
}

export async function createControlWithKpis(
  input: CreateControlInput
): Promise<{ ok: true; control_id: string } | { ok: false; error: string }> {
  const ctx = await getContext()

  try {
    const frameworkName = _norm(input.framework)
    const control_code = _norm(input.control_code)
    const control_name = _norm(input.control_name)

    if (!frameworkName) return { ok: false, error: "Framework é obrigatório." }
    if (!control_code) return { ok: false, error: "Código do controle (control_code) é obrigatório." }
    if (!control_name) return { ok: false, error: "Nome do controle (control_name) é obrigatório." }

    if (!_norm(input.control_owner_email) || !_norm(input.control_owner_name)) {
      return { ok: false, error: "Control Owner (nome e email) é obrigatório." }
    }

    // 1) Framework
    const fwRes = await sql<{ id: string }>`
      INSERT INTO frameworks (tenant_id, name, created_at)
      VALUES (${ctx.tenantId}::uuid, ${frameworkName}, now())
      ON CONFLICT (tenant_id, name)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id::text AS id
    `
    const framework_id = fwRes.rows?.[0]?.id
    if (!framework_id) return { ok: false, error: "Falha ao resolver framework_id." }

    // 2) Risk (opcional)
    let risk_id: string | null = null
    const risk_code = emptyToNull(input.risk_code)
    if (risk_code) {
      const riskRes = await sql<{ id: string }>`
        INSERT INTO risk_catalog (
          tenant_id, risk_code, title, description, classification, created_at
        )
        VALUES (
          ${ctx.tenantId}::uuid,
          ${risk_code},
          ${emptyToNull(input.risk_name)},
          ${emptyToNull(input.risk_description)},
          ${normalizeRiskClassification(input.risk_classification)},
          now()
        )
        ON CONFLICT (tenant_id, risk_code)
        DO UPDATE SET
          title = COALESCE(EXCLUDED.title, risk_catalog.title),
          description = COALESCE(EXCLUDED.description, risk_catalog.description),
          classification = COALESCE(EXCLUDED.classification, risk_catalog.classification),
          updated_at = now()
        RETURNING id::text AS id
      `
      risk_id = riskRes.rows?.[0]?.id ?? null
    }

    // 3) não permitir duplicado
    const exists = await sql<{ id: string }>`
      SELECT id
      FROM controls
      WHERE tenant_id = ${ctx.tenantId}::uuid
        AND control_code = ${control_code}
      LIMIT 1
    `
    if (exists.rowCount) {
      return { ok: false, error: `Já existe um controle com code "${control_code}" neste tenant.` }
    }

    // 4) inserir controle
    const control = await sql<{ id: string }>`
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
        mes_ref,
        created_at,
        updated_at
      )
      VALUES (
        ${ctx.tenantId}::uuid,
        ${framework_id}::uuid,
        ${risk_id ? (risk_id as any) : null}::uuid,
        ${control_code},
        ${control_name},
        ${emptyToNull(input.control_description)},
        ${emptyToNull(input.control_goal)},
        ${normalizeControlStatus(emptyToNull(input.control_status))}::control_status,
        ${normalizeControlFrequency(emptyToNull(input.control_frequency))}::control_frequency,
        ${emptyToNull(input.control_type)},
        ${emptyToNull(input.control_owner_email)},
        ${emptyToNull(input.control_owner_name)},
        ${emptyToNull(input.focal_point_email)},
        ${emptyToNull(input.focal_point_name)},
        date_trunc("month", (now() AT TIME ZONE 'America/Sao_Paulo'))::date,
        now(),
        now()
      )
      RETURNING id::text AS id
    `
    const control_id = control.rows?.[0]?.id
    if (!control_id) return { ok: false, error: "Falha ao criar controle." }

    // 5) audit_events
    const actor_user_id = await resolveActorUserId(ctx)

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
        'control',
        ${control_id}::uuid,
        'created',
        ${actor_user_id ? (actor_user_id as any) : null}::uuid,
        ${JSON.stringify({ control_code, control_id, framework_id, framework: frameworkName, risk_id })}::jsonb,
        now()
      )
    `

    // 6) KPIs (opcional) — ✅ evita "KPI updated" indevido quando nada mudou
    for (const k of input.kpis || []) {
      const kpi_code = _norm(k.kpi_code)
      const kpi_name = _norm(k.kpi_name)
      if (!kpi_code || !kpi_name) continue

      const kpi_type = normalizeKpiType(k.kpi_type)
      if (!kpi_type) return { ok: false, error: `kpi_type inválido no KPI ${kpi_code}` }

      const op = normalizeOperator(k.kpi_target_operator)
      if (!op) return { ok: false, error: `kpi_target_operator inválido no KPI ${kpi_code}` }

      const warning_db = parseWarningPctToDb(k.kpi_warning_buffer_pct) ?? 0.05
      const nextDesc = emptyToNull(k.kpi_description)
      const nextTarget = k.kpi_target_value

      const existingKpi = await fetchExistingKpiByCode(ctx, kpi_code)
      const existedBefore = Boolean(existingKpi)

      // ✅ decide se realmente mudou (inclui mudar de control_id ao “anexar” KPI existente)
      let willChange = false
      if (!existingKpi) {
        willChange = true
      } else {
        if (!sameNullable(existingKpi.control_id, control_id)) willChange = true
        if (!sameNullable(existingKpi.kpi_name, kpi_name)) willChange = true
        if (!sameNullable(existingKpi.kpi_description, nextDesc)) willChange = true
        if (!sameNullable(existingKpi.kpi_type, kpi_type)) willChange = true
        if (!sameNullable(existingKpi.target_operator, op)) willChange = true
        if (!sameNullable(existingKpi.target_value, nextTarget)) willChange = true
        if (!sameNullable(existingKpi.warning_buffer_pct, warning_db)) willChange = true
      }

      // ✅ se NÃO mudou nada, não faz upsert e não audita
      if (!willChange) continue

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
          ${ctx.tenantId}::uuid,
          ${control_id}::uuid,
          ${kpi_code},
          ${kpi_name},
          ${nextDesc},
          ${kpi_type},
          ${op},
          ${nextTarget},
          ${warning_db},
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
      if (!kpi_id) return { ok: false, error: `Falha ao criar/atualizar KPI ${kpi_code}.` }

      // metadata com before/after/changes (já pronto pro history-actions evoluir depois)
      const ba = buildKpiBeforeAfter(existingKpi, {
        control_id,
        kpi_name,
        kpi_description: nextDesc,
        kpi_type,
        target_operator: op,
        target_value: nextTarget,
        warning_buffer_pct: warning_db,
      })

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
          ${kpi_id}::uuid,
          ${existedBefore ? "updated" : "created"},
          ${actor_user_id ? (actor_user_id as any) : null}::uuid,
          ${JSON.stringify({
            kpi_code,
            kpi_id,
            control_id,
            control_code,
            ...ba,
          })}::jsonb,
          now()
        )
      `
    }

    revalidatePath("/controles")
    revalidatePath(`/controles/${control_id}`)

    return { ok: true, control_id }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Erro inesperado ao salvar controle." }
  }
}

/**
 * ✅ UPDATE: salva em cima do controle existente.
 * ✅ FIX: NÃO gera audit de KPI atualizado se o KPI não mudou.
 * ✅ FIX: NÃO faz UPSERT de KPI se nada mudou (evita updated_at e evita audit indevido).
 * ✅ AUDIT: control updated inclui before/after/changes (pra UI mostrar "o que mudou").
 */
export async function updateControlWithKpis(
  controlId: string,
  input: CreateControlInput
): Promise<{ ok: true; control_id: string } | { ok: false; error: string }> {
  const ctx = await getContext()
  const control_id = String(controlId || "").trim()

  try {
    if (!control_id) return { ok: false, error: "controlId é obrigatório." }

    // BEFORE (para diff do controle)
    const ctlBefore = await sql<{
      id: string
      control_code: string
      name: string
      description: string | null
      goal: string | null
      status: string | null
      frequency: string | null
      control_type: string | null
      control_owner_email: string | null
      control_owner_name: string | null
      focal_point_email: string | null
      focal_point_name: string | null
      framework_name: string | null
      risk_code: string | null
      risk_title: string | null
      risk_description: string | null
      risk_classification: string | null
    }>`
      SELECT
        c.id::text AS id,
        c.control_code::text AS control_code,
        c.name::text AS name,
        c.description::text AS description,
        c.goal::text AS goal,
        c.status::text AS status,
        c.frequency::text AS frequency,
        c.control_type::text AS control_type,
        c.control_owner_email::text AS control_owner_email,
        c.control_owner_name::text AS control_owner_name,
        c.focal_point_email::text AS focal_point_email,
        c.focal_point_name::text AS focal_point_name,
        f.name::text AS framework_name,
        rc.risk_code::text AS risk_code,
        rc.title::text AS risk_title,
        rc.description::text AS risk_description,
        rc.classification::text AS risk_classification
      FROM controls c
      LEFT JOIN frameworks f
        ON f.tenant_id = c.tenant_id
       AND f.id = c.framework_id
      LEFT JOIN risk_catalog rc
        ON rc.tenant_id = c.tenant_id
       AND rc.id = c.risk_id
      WHERE c.tenant_id = ${ctx.tenantId}::uuid
        AND c.id = ${control_id}::uuid
      LIMIT 1
    `
    if (!ctlBefore.rowCount) return { ok: false, error: "Controle não encontrado (ou fora do tenant)." }
    const before = ctlBefore.rows[0]

    const frameworkName = _norm(input.framework)
    const new_control_code = _norm(input.control_code)
    const control_name = _norm(input.control_name)

    if (!frameworkName) return { ok: false, error: "Framework é obrigatório." }
    if (!new_control_code) return { ok: false, error: "Código do controle (control_code) é obrigatório." }
    if (!control_name) return { ok: false, error: "Nome do controle (control_name) é obrigatório." }
    if (!_norm(input.control_owner_email) || !_norm(input.control_owner_name)) {
      return { ok: false, error: "Control Owner (nome e email) é obrigatório." }
    }

    // 1) Framework (upsert)
    const fwRes = await sql<{ id: string }>`
      INSERT INTO frameworks (tenant_id, name, created_at)
      VALUES (${ctx.tenantId}::uuid, ${frameworkName}, now())
      ON CONFLICT (tenant_id, name)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id::text AS id
    `
    const framework_id = fwRes.rows?.[0]?.id
    if (!framework_id) return { ok: false, error: "Falha ao resolver framework_id." }

    // 2) Risk (opcional)
    let risk_id: string | null = null
    const risk_code = emptyToNull(input.risk_code)
    if (risk_code) {
      const riskRes = await sql<{ id: string }>`
        INSERT INTO risk_catalog (
          tenant_id, risk_code, title, description, classification, created_at
        )
        VALUES (
          ${ctx.tenantId}::uuid,
          ${risk_code},
          ${emptyToNull(input.risk_name)},
          ${emptyToNull(input.risk_description)},
          ${normalizeRiskClassification(input.risk_classification)},
          now()
        )
        ON CONFLICT (tenant_id, risk_code)
        DO UPDATE SET
          title = COALESCE(EXCLUDED.title, risk_catalog.title),
          description = COALESCE(EXCLUDED.description, risk_catalog.description),
          classification = COALESCE(EXCLUDED.classification, risk_catalog.classification),
          updated_at = now()
        RETURNING id::text AS id
      `
      risk_id = riskRes.rows?.[0]?.id ?? null
    }

    // 3) garantir control_code único no tenant (exceto o próprio)
    const dup = await sql<{ id: string }>`
      SELECT id
      FROM controls
      WHERE tenant_id = ${ctx.tenantId}::uuid
        AND control_code = ${new_control_code}
        AND id <> ${control_id}::uuid
      LIMIT 1
    `
    if (dup.rowCount) {
      return { ok: false, error: `Já existe outro controle com code "${new_control_code}" neste tenant.` }
    }

    const next_status = normalizeControlStatus(emptyToNull(input.control_status))
    const next_frequency = normalizeControlFrequency(emptyToNull(input.control_frequency))
    const next_control_type = emptyToNull(input.control_type)

    // 4) update control
    await sql`
      UPDATE controls
      SET
        framework_id = ${framework_id}::uuid,
        risk_id = ${risk_id ? (risk_id as any) : null}::uuid,
        control_code = ${new_control_code},
        name = ${control_name},
        description = ${emptyToNull(input.control_description)},
        goal = ${emptyToNull(input.control_goal)},
        status = ${next_status}::control_status,
        frequency = ${next_frequency}::control_frequency,
        control_type = ${next_control_type},
        control_owner_email = ${emptyToNull(input.control_owner_email)},
        control_owner_name = ${emptyToNull(input.control_owner_name)},
        focal_point_email = ${emptyToNull(input.focal_point_email)},
        focal_point_name = ${emptyToNull(input.focal_point_name)},
        updated_at = now()
      WHERE tenant_id = ${ctx.tenantId}::uuid
        AND id = ${control_id}::uuid
    `

    // 5) audit control updated (before/after/changes)
    const actor_user_id = await resolveActorUserId(ctx)

    const after = {
      control_code: new_control_code,
      name: control_name,
      description: emptyToNull(input.control_description),
      goal: emptyToNull(input.control_goal),
      status: next_status,
      frequency: next_frequency,
      control_type: next_control_type,
      control_owner_email: emptyToNull(input.control_owner_email),
      control_owner_name: emptyToNull(input.control_owner_name),
      focal_point_email: emptyToNull(input.focal_point_email),
      focal_point_name: emptyToNull(input.focal_point_name),
      framework: frameworkName,
      risk_id,
      risk_code: risk_code ?? null,
      risk_name: emptyToNull(input.risk_name),
      risk_description: emptyToNull(input.risk_description),
      risk_classification: normalizeRiskClassification(input.risk_classification),
    }

    const changes: Record<string, { from: any; to: any }> = {}
    function addChange(key: string, from: any, to: any) {
      const f = from ?? null
      const t = to ?? null
      if (!sameNullable(f, t)) changes[key] = { from: f, to: t }
    }

    addChange("control_code", before.control_code, after.control_code)
    addChange("name", before.name, after.name)
    addChange("description", before.description, after.description)
    addChange("goal", before.goal, after.goal)
    addChange("status", before.status, after.status)
    addChange("frequency", before.frequency, after.frequency)
    addChange("control_type", before.control_type, after.control_type)
    addChange("control_owner_email", before.control_owner_email, after.control_owner_email)
    addChange("control_owner_name", before.control_owner_name, after.control_owner_name)
    addChange("focal_point_email", before.focal_point_email, after.focal_point_email)
    addChange("focal_point_name", before.focal_point_name, after.focal_point_name)
    addChange("framework", before.framework_name, after.framework)

    addChange("risk_code", before.risk_code, after.risk_code)
    addChange("risk_name", before.risk_title, after.risk_name)
    addChange("risk_description", before.risk_description, after.risk_description)
    addChange("risk_classification", before.risk_classification, after.risk_classification)

    // ✅ Se não mudou nada no controle, ainda assim você pode querer registrar (opcional).
    // Aqui vamos registrar sempre (como estava), mas com changes vazio quando nada mudou.
    await sql`
      INSERT INTO audit_events (
        tenant_id, entity_type, entity_id, action, actor_user_id, metadata, created_at
      )
      VALUES (
        ${ctx.tenantId}::uuid,
        'control',
        ${control_id}::uuid,
        'updated',
        ${actor_user_id ? (actor_user_id as any) : null}::uuid,
        ${JSON.stringify({
          control_id,
          before: {
            control_code: before.control_code,
            name: before.name,
            description: before.description,
            goal: before.goal,
            status: before.status,
            frequency: before.frequency,
            control_type: before.control_type,
            control_owner_email: before.control_owner_email,
            control_owner_name: before.control_owner_name,
            focal_point_email: before.focal_point_email,
            focal_point_name: before.focal_point_name,
            framework: before.framework_name,
            risk_code: before.risk_code,
            risk_name: before.risk_title,
            risk_description: before.risk_description,
            risk_classification: before.risk_classification,
          },
          after,
          changes,
        })}::jsonb,
        now()
      )
    `

    // 6) KPIs do controle (pra deletar removidos)
    const existing = await sql<{ kpi_code: string }>`
      SELECT kpi_code::text AS kpi_code
      FROM kpis
      WHERE tenant_id = ${ctx.tenantId}::uuid
        AND control_id = ${control_id}::uuid
    `
    const existingSet = new Set(existing.rows.map((x) => String(x.kpi_code || "").trim()))
    const incomingSet = new Set<string>()

    for (const k of input.kpis || []) {
      const kpi_code = _norm(k.kpi_code)
      const kpi_name = _norm(k.kpi_name)
      if (!kpi_code || !kpi_name) continue
      incomingSet.add(kpi_code)

      const kpi_type = normalizeKpiType(k.kpi_type)
      if (!kpi_type) return { ok: false, error: `kpi_type inválido no KPI ${kpi_code}` }

      const op = normalizeOperator(k.kpi_target_operator)
      if (!op) return { ok: false, error: `kpi_target_operator inválido no KPI ${kpi_code}` }

      const warning_db = (parseWarningPctToDb(k.kpi_warning_buffer_pct) ?? 0.05) as number
      const nextDesc = emptyToNull(k.kpi_description)
      const nextTarget = k.kpi_target_value

      const existingKpi = await fetchExistingKpiByCode(ctx, kpi_code)
      const existedBefore = Boolean(existingKpi)

      // ✅ decide se realmente mudou
      let willChange = false
      if (!existingKpi) {
        willChange = true
      } else {
        if (!sameNullable(existingKpi.control_id, control_id)) willChange = true
        if (!sameNullable(existingKpi.kpi_name, kpi_name)) willChange = true
        if (!sameNullable(existingKpi.kpi_description, nextDesc)) willChange = true
        if (!sameNullable(existingKpi.kpi_type, kpi_type)) willChange = true
        if (!sameNullable(existingKpi.target_operator, op)) willChange = true
        if (!sameNullable(existingKpi.target_value, nextTarget)) willChange = true
        if (!sameNullable(existingKpi.warning_buffer_pct, warning_db)) willChange = true
      }

      // ✅ se NÃO mudou nada, não faz upsert e não audita
      if (!willChange) continue

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
          ${ctx.tenantId}::uuid,
          ${control_id}::uuid,
          ${kpi_code},
          ${kpi_name},
          ${nextDesc},
          ${kpi_type},
          ${op},
          ${nextTarget},
          ${warning_db},
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
      if (!kpi_id) return { ok: false, error: `Falha ao criar/atualizar KPI ${kpi_code}.` }

      const ba = buildKpiBeforeAfter(existingKpi, {
        control_id,
        kpi_name,
        kpi_description: nextDesc,
        kpi_type,
        target_operator: op,
        target_value: nextTarget,
        warning_buffer_pct: warning_db,
      })

      await sql`
        INSERT INTO audit_events (
          tenant_id, entity_type, entity_id, action, actor_user_id, metadata, created_at
        )
        VALUES (
          ${ctx.tenantId}::uuid,
          'kpi',
          ${kpi_id}::uuid,
          ${existedBefore ? "updated" : "created"},
          ${actor_user_id ? (actor_user_id as any) : null}::uuid,
          ${JSON.stringify({
            kpi_code,
            kpi_id,
            control_id,
            control_code: new_control_code,
            ...ba,
          })}::jsonb,
          now()
        )
      `
    }

    // 7) deletar KPIs removidos do form (somente os que pertencem ao controle)
    const toDelete = Array.from(existingSet).filter((code) => !incomingSet.has(code))

    for (const code of toDelete) {
      const del = await sql<{ id: string }>`
        DELETE FROM kpis
        WHERE tenant_id = ${ctx.tenantId}::uuid
          AND control_id = ${control_id}::uuid
          AND kpi_code = ${code}
        RETURNING id::text AS id
      `
      const deletedId = del.rows?.[0]?.id
      if (deletedId) {
        await sql`
          INSERT INTO audit_events (
            tenant_id, entity_type, entity_id, action, actor_user_id, metadata, created_at
          )
          VALUES (
            ${ctx.tenantId}::uuid,
            'kpi',
            ${deletedId}::uuid,
            'deleted',
            ${actor_user_id ? (actor_user_id as any) : null}::uuid,
            ${JSON.stringify({ kpi_code: code, kpi_id: deletedId, control_id, control_code: new_control_code })}::jsonb,
            now()
          )
        `
      }
    }

    revalidatePath("/controles")
    revalidatePath(`/controles/${control_id}`)
    revalidatePath(`/controles/${control_id}/editar`)

    return { ok: true, control_id }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Erro inesperado ao atualizar controle." }
  }
}