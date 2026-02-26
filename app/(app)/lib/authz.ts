// app/(app)/lib/authz.ts
"use server"

import { cache } from "react"
import { sql } from "@vercel/postgres"
import { getContext } from "./context"
import { ensureRbacTables } from "./rbac-schema"

export type ScopeFilterResult = {
  canViewAll: boolean
  teamIds: string[]
}

/**
 * Retorna os IDs dos teams do usuário no tenant.
 * Se o usuário não pertence a nenhum team, atribui ao Default Team e retorna.
 * cache() deduplica chamadas com os mesmos args na mesma requisição.
 */
export const getUserTeams = cache(async (
  tenantId: string,
  userId: string
): Promise<string[]> => {
  await ensureRbacTables()

  const { rows } = await sql<{ team_id: string }>`
    SELECT tm.team_id::text AS team_id
    FROM team_members tm
    WHERE tm.tenant_id = ${tenantId}::uuid
      AND tm.user_id = ${userId}::uuid
  `

  const teamIds = rows.map((r) => r.team_id)

  if (teamIds.length === 0) {
    // Auto-assign ao Default Team
    const defaultTeam = await getOrCreateDefaultTeam(tenantId)
    await sql`
      INSERT INTO team_members (tenant_id, team_id, user_id)
      VALUES (${tenantId}::uuid, ${defaultTeam}::uuid, ${userId}::uuid)
      ON CONFLICT (tenant_id, team_id, user_id) DO NOTHING
    `
    return [defaultTeam]
  }

  return teamIds
})

async function getOrCreateDefaultTeam(tenantId: string): Promise<string> {
  const found = await sql<{ id: string }>`
    SELECT id::text AS id
    FROM teams
    WHERE tenant_id = ${tenantId}::uuid
      AND LOWER(name) = 'default'
    LIMIT 1
  `
  if (found.rows[0]?.id) return found.rows[0].id

  const ins = await sql<{ id: string }>`
    INSERT INTO teams (tenant_id, name)
    VALUES (${tenantId}::uuid, 'Default')
    RETURNING id::text AS id
  `
  const id = ins.rows[0]?.id
  if (!id) throw new Error("Falha ao criar Default Team")

  // Bootstrap Admin role + permissões no Default team
  const { ensureDefaultTeamAdminRole } = await import("./rbac-seed")
  await ensureDefaultTeamAdminRole()

  return id
}

/**
 * Retorna Set<string> de permission keys herdadas via team_roles -> role_permissions.
 * cache() deduplica chamadas com os mesmos args na mesma requisição.
 */
export const getEffectivePermissions = cache(async (
  tenantId: string,
  userId: string
): Promise<Set<string>> => {
  await ensureRbacTables()

  const { rows } = await sql<{ key: string }>`
    SELECT DISTINCT p.key::text AS key
    FROM team_members tm
    JOIN team_roles tr ON tr.team_id = tm.team_id
      AND tr.tenant_id = tm.tenant_id
    JOIN role_permissions rp ON rp.role_id = tr.role_id
      AND rp.tenant_id = tr.tenant_id
    JOIN permissions p ON p.id = rp.permission_id
      AND p.tenant_id = rp.tenant_id
    WHERE tm.tenant_id = ${tenantId}::uuid
      AND tm.user_id = ${userId}::uuid
  `

  return new Set(rows.map((r) => r.key))
})

/**
 * Lança erro se o usuário não tiver a permissão.
 */
export async function requirePermission(
  tenantId: string,
  userId: string,
  permissionKey: string
): Promise<void> {
  const perms = await getEffectivePermissions(tenantId, userId)
  if (!perms.has(permissionKey)) {
    throw new Error(`Acesso negado: falta permissão "${permissionKey}".`)
  }
}

/**
 * Constrói o filtro de scope para queries.
 * - canViewAll: true se tiver a permissão allowAllPermissionKey
 * - teamIds: IDs dos teams do usuário (para filtrar team_id IN (...))
 */
export async function buildScopeFilter(
  tenantId: string,
  userId: string,
  opts: {
    moduleKeyPrefix?: string
    allowAllPermissionKey: string
  }
): Promise<ScopeFilterResult> {
  const [teamIds, perms] = await Promise.all([
    getUserTeams(tenantId, userId),
    getEffectivePermissions(tenantId, userId),
  ])

  const canViewAll = perms.has(opts.allowAllPermissionKey)
  return { canViewAll, teamIds }
}

/**
 * Helper: scope filter para dashboard.
 * dashboard:view_all permite ver tudo; caso contrário filtra por teams.
 */
export async function getDashboardScope(
  tenantId: string,
  userId: string
): Promise<ScopeFilterResult> {
  return buildScopeFilter(tenantId, userId, {
    allowAllPermissionKey: "dashboard:view_all",
  })
}

/**
 * Helper: scope filter para controls.
 */
export async function getControlsScope(
  tenantId: string,
  userId: string
): Promise<ScopeFilterResult> {
  return buildScopeFilter(tenantId, userId, {
    allowAllPermissionKey: "controls:view_all",
  })
}

/**
 * Helper: scope filter para risks.
 */
export async function getRisksScope(
  tenantId: string,
  userId: string
): Promise<ScopeFilterResult> {
  return buildScopeFilter(tenantId, userId, {
    allowAllPermissionKey: "risks:view_all",
  })
}

/**
 * Helper: scope filter para action_plans.
 */
export async function getActionPlansScope(
  tenantId: string,
  userId: string
): Promise<ScopeFilterResult> {
  return buildScopeFilter(tenantId, userId, {
    allowAllPermissionKey: "action_plans:view_all",
  })
}

/**
 * Helper: scope filter para audit_campaigns.
 */
export async function getAuditCampaignsScope(
  tenantId: string,
  userId: string
): Promise<ScopeFilterResult> {
  return buildScopeFilter(tenantId, userId, {
    allowAllPermissionKey: "audit_campaigns:view_all",
  })
}
