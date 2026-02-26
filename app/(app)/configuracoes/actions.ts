// app/(app)/configuracoes/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

// ==============================
// TYPES
// ==============================

export type SettingsTab = "empresa" | "permissoes" | "integracoes"

export type TenantSettings = {
  tenant_id: string

  // empresa
  legal_name: string
  cnpj: string
  primary_sector: string
  admin_email: string

  // localidade
  locale_language: string
  timezone: string

  // branding
  logo_url: string | null

  // auditoria / integração drive (se você já usa no módulo de auditorias)
  drive_folder_id: string | null
  drive_folder_url: string | null

  updated_at: string
}

export type PermissionRole = "admin" | "analista" | "auditor_externo"
export type PermissionModule = "finance" | "users" | "action_plans"

// matriz: módulo -> role -> boolean
export type PermissionMatrix = Record<PermissionModule, Record<PermissionRole, boolean>>

export type IntegrationKey = "slack" | "jira" | "sap"
export type IntegrationStatus = "connected" | "available" | "soon"

export type IntegrationRow = {
  integration_key: IntegrationKey
  status: IntegrationStatus
  display_name: string
  description: string
  connected_email: string | null
  updated_at: string
}

// ==============================
// HELPERS
// ==============================

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "")
}

function formatCnpj(v: string) {
  const d = onlyDigits(v).slice(0, 14)
  const p1 = d.slice(0, 2)
  const p2 = d.slice(2, 5)
  const p3 = d.slice(5, 8)
  const p4 = d.slice(8, 12)
  const p5 = d.slice(12, 14)
  let out = p1
  if (p2) out += `.${p2}`
  if (p3) out += `.${p3}`
  if (p4) out += `/${p4}`
  if (p5) out += `-${p5}`
  return out
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim())
}

function assertRoleAllowed(ctx: any) {
  // Ajuste conforme seu getContext()
  // ✅ por padrão, só admin pode mexer em configurações
  const role = (ctx?.role || "").toLowerCase()
  if (role && role !== "admin") throw new Error("Acesso negado: apenas Administrador pode alterar configurações.")
}

// ==============================
// SETTINGS (TENANT)
// ==============================

/**
 * Busca configurações do tenant.
 * Requer tabela `tenant_settings` (sugerida):
 *
 * CREATE TABLE IF NOT EXISTS tenant_settings (
 *   tenant_id uuid PRIMARY KEY,
 *   legal_name text NOT NULL,
 *   cnpj text NOT NULL,
 *   primary_sector text NOT NULL,
 *   admin_email text NOT NULL,
 *   locale_language text NOT NULL DEFAULT 'pt-BR',
 *   timezone text NOT NULL DEFAULT 'UTC-03',
 *   logo_url text NULL,
 *   drive_folder_id text NULL,
 *   drive_folder_url text NULL,
 *   updated_at timestamptz NOT NULL DEFAULT now()
 * );
 */
export async function fetchTenantSettings(): Promise<TenantSettings> {
  const ctx = await getContext()
  if (!ctx?.tenantId) throw new Error("Contexto inválido (tenant).")

  const { rows } = await sql<TenantSettings>`
    SELECT
      tenant_id::text AS tenant_id,
      legal_name,
      cnpj,
      primary_sector,
      admin_email,
      locale_language,
      timezone,
      logo_url,
      drive_folder_id,
      drive_folder_url,
      updated_at::text AS updated_at
    FROM tenant_settings
    WHERE tenant_id = ${ctx.tenantId}
    LIMIT 1;
  `

  // Se ainda não existir registro, crie defaults (upsert)
  if (!rows?.[0]) {
    const { rows: created } = await sql<TenantSettings>`
      INSERT INTO tenant_settings (
        tenant_id,
        legal_name,
        cnpj,
        primary_sector,
        admin_email,
        locale_language,
        timezone
      )
      VALUES (
        ${ctx.tenantId},
        'Minha Empresa',
        '00.000.000/0000-00',
        'Tecnologia e SaaS',
        ${ctx?.userEmail || 'admin@empresa.com'},
        'pt-BR',
        'UTC-03'
      )
      ON CONFLICT (tenant_id) DO NOTHING
      RETURNING
        tenant_id::text AS tenant_id,
        legal_name,
        cnpj,
        primary_sector,
        admin_email,
        locale_language,
        timezone,
        logo_url,
        drive_folder_id,
        drive_folder_url,
        updated_at::text AS updated_at;
    `
    // se não retornou por DO NOTHING, busca novamente
    if (created?.[0]) return created[0]
    const { rows: again } = await sql<TenantSettings>`
      SELECT
        tenant_id::text AS tenant_id,
        legal_name,
        cnpj,
        primary_sector,
        admin_email,
        locale_language,
        timezone,
        logo_url,
        drive_folder_id,
        drive_folder_url,
        updated_at::text AS updated_at
      FROM tenant_settings
      WHERE tenant_id = ${ctx.tenantId}
      LIMIT 1;
    `
    if (!again?.[0]) throw new Error("Falha ao inicializar configurações do tenant.")
    return again[0]
  }

  return rows[0]
}

export type UpdateTenantSettingsInput = {
  legal_name: string
  cnpj: string
  primary_sector: string
  admin_email: string
  locale_language: string
  timezone: string

  logo_url?: string | null

  drive_folder_id?: string | null
  drive_folder_url?: string | null
}

export async function updateTenantSettings(input: UpdateTenantSettingsInput): Promise<{ ok: true }> {
  const ctx = await getContext()
  if (!ctx?.tenantId) throw new Error("Contexto inválido (tenant).")

  assertRoleAllowed(ctx)

  const legalName = (input?.legal_name || "").trim()
  const cnpj = formatCnpj(input?.cnpj || "")
  const primarySector = (input?.primary_sector || "").trim()
  const adminEmail = (input?.admin_email || "").trim()
  const localeLanguage = (input?.locale_language || "pt-BR").trim()
  const timezone = (input?.timezone || "UTC-03").trim()

  const logoUrl = input?.logo_url ?? null
  const driveFolderId = input?.drive_folder_id ?? null
  const driveFolderUrl = input?.drive_folder_url ?? null

  if (!legalName) throw new Error("Informe a razão social.")
  if (onlyDigits(cnpj).length !== 14) throw new Error("CNPJ inválido.")
  if (!primarySector) throw new Error("Informe o setor primário.")
  if (!isEmail(adminEmail)) throw new Error("E-mail administrativo inválido.")
  if (!localeLanguage) throw new Error("Idioma inválido.")
  if (!timezone) throw new Error("Fuso horário inválido.")

  await sql`
    INSERT INTO tenant_settings (
      tenant_id,
      legal_name,
      cnpj,
      primary_sector,
      admin_email,
      locale_language,
      timezone,
      logo_url,
      drive_folder_id,
      drive_folder_url,
      updated_at
    )
    VALUES (
      ${ctx.tenantId},
      ${legalName},
      ${cnpj},
      ${primarySector},
      ${adminEmail},
      ${localeLanguage},
      ${timezone},
      ${logoUrl},
      ${driveFolderId},
      ${driveFolderUrl},
      now()
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
      legal_name = EXCLUDED.legal_name,
      cnpj = EXCLUDED.cnpj,
      primary_sector = EXCLUDED.primary_sector,
      admin_email = EXCLUDED.admin_email,
      locale_language = EXCLUDED.locale_language,
      timezone = EXCLUDED.timezone,
      logo_url = EXCLUDED.logo_url,
      drive_folder_id = EXCLUDED.drive_folder_id,
      drive_folder_url = EXCLUDED.drive_folder_url,
      updated_at = now();
  `

  return { ok: true }
}

// ==============================
// PERMISSIONS (MATRIX)
// ==============================

/**
 * Matriz simples de permissões do tenant.
 * Tabela sugerida:
 *
 * CREATE TABLE IF NOT EXISTS tenant_permission_matrix (
 *   tenant_id uuid PRIMARY KEY,
 *   matrix jsonb NOT NULL,
 *   updated_at timestamptz NOT NULL DEFAULT now()
 * );
 */
export async function fetchPermissionMatrix(): Promise<PermissionMatrix> {
  const ctx = await getContext()
  if (!ctx?.tenantId) throw new Error("Contexto inválido (tenant).")

  const { rows } = await sql<{ matrix: any }>`
    SELECT matrix
    FROM tenant_permission_matrix
    WHERE tenant_id = ${ctx.tenantId}
    LIMIT 1;
  `

  const defaultMatrix: PermissionMatrix = {
    finance: { admin: true, analista: true, auditor_externo: false },
    users: { admin: true, analista: false, auditor_externo: false },
    action_plans: { admin: true, analista: true, auditor_externo: true },
  }

  if (!rows?.[0]?.matrix) return defaultMatrix

  // retorna o json como está, mas com fallback em chaves faltantes
  const m = rows[0].matrix as Partial<PermissionMatrix>

  return {
    finance: { ...defaultMatrix.finance, ...(m.finance || {}) },
    users: { ...defaultMatrix.users, ...(m.users || {}) },
    action_plans: { ...defaultMatrix.action_plans, ...(m.action_plans || {}) },
  }
}

export async function updatePermissionMatrix(matrix: PermissionMatrix): Promise<{ ok: true }> {
  const ctx = await getContext()
  if (!ctx?.tenantId) throw new Error("Contexto inválido (tenant).")

  assertRoleAllowed(ctx)

  // validação mínima de formato
  const requiredModules: PermissionModule[] = ["finance", "users", "action_plans"]
  const requiredRoles: PermissionRole[] = ["admin", "analista", "auditor_externo"]

  for (const mod of requiredModules) {
    if (!matrix?.[mod]) throw new Error(`Matriz inválida: módulo ausente (${mod}).`)
    for (const role of requiredRoles) {
      if (typeof matrix[mod][role] !== "boolean") {
        throw new Error(`Matriz inválida: ${mod}.${role} precisa ser boolean.`)
      }
    }
  }

  await sql`
    INSERT INTO tenant_permission_matrix (tenant_id, matrix, updated_at)
    VALUES (${ctx.tenantId}, ${JSON.stringify(matrix)}::jsonb, now())
    ON CONFLICT (tenant_id) DO UPDATE SET
      matrix = EXCLUDED.matrix,
      updated_at = now();
  `

  return { ok: true }
}

// ==============================
// INTEGRATIONS (OPTIONAL LIST)
// ==============================

/**
 * Se você quiser persistir status das integrações por tenant.
 * Tabela sugerida:
 *
 * CREATE TABLE IF NOT EXISTS tenant_integrations (
 *   tenant_id uuid NOT NULL,
 *   integration_key text NOT NULL,
 *   status text NOT NULL,
 *   display_name text NOT NULL,
 *   description text NOT NULL,
 *   connected_email text NULL,
 *   updated_at timestamptz NOT NULL DEFAULT now(),
 *   PRIMARY KEY (tenant_id, integration_key)
 * );
 */
export async function fetchIntegrations(): Promise<IntegrationRow[]> {
  const ctx = await getContext()
  if (!ctx?.tenantId) throw new Error("Contexto inválido (tenant).")

  const { rows } = await sql<IntegrationRow>`
    SELECT
      integration_key::text AS integration_key,
      status::text AS status,
      display_name,
      description,
      connected_email,
      updated_at::text AS updated_at
    FROM tenant_integrations
    WHERE tenant_id = ${ctx.tenantId}
    ORDER BY integration_key ASC;
  `

  return rows
}

export type UpdateIntegrationInput = {
  integration_key: IntegrationKey
  status: IntegrationStatus
  connected_email?: string | null
  display_name?: string
  description?: string
}

export async function updateIntegration(input: UpdateIntegrationInput): Promise<{ ok: true }> {
  const ctx = await getContext()
  if (!ctx?.tenantId) throw new Error("Contexto inválido (tenant).")

  assertRoleAllowed(ctx)

  const integrationKey = (input?.integration_key || "").trim() as IntegrationKey
  const status = (input?.status || "").trim() as IntegrationStatus

  const allowedKeys: IntegrationKey[] = ["slack", "jira", "sap"]
  const allowedStatus: IntegrationStatus[] = ["connected", "available", "soon"]

  if (!allowedKeys.includes(integrationKey)) throw new Error("Integração inválida.")
  if (!allowedStatus.includes(status)) throw new Error("Status inválido.")

  const displayName =
    (input?.display_name || "").trim() ||
    (integrationKey === "slack" ? "Slack" : integrationKey === "jira" ? "Jira Cloud" : "SAP ERP")

  const description =
    (input?.description || "").trim() ||
    (integrationKey === "slack"
      ? "Envie alertas de conformidade para seus canais."
      : integrationKey === "jira"
      ? "Sincronize tarefas e auditorias com seus projetos."
      : "Monitoramento automático de riscos financeiros.")

  const connectedEmail = (input?.connected_email || "").trim() || null

  await sql`
    INSERT INTO tenant_integrations (
      tenant_id,
      integration_key,
      status,
      display_name,
      description,
      connected_email,
      updated_at
    )
    VALUES (
      ${ctx.tenantId},
      ${integrationKey},
      ${status},
      ${displayName},
      ${description},
      ${connectedEmail},
      now()
    )
    ON CONFLICT (tenant_id, integration_key) DO UPDATE SET
      status = EXCLUDED.status,
      display_name = EXCLUDED.display_name,
      description = EXCLUDED.description,
      connected_email = EXCLUDED.connected_email,
      updated_at = now();
  `

  return { ok: true }
}