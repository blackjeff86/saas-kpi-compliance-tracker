// app/(app)/admin/rbac/actions.ts
"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@vercel/postgres"
import { getContext } from "../../lib/context"
import { requirePermission } from "../../lib/authz"
import { seedBasePermissions, ensureDefaultTeamAdminRole, seedBaseRoles } from "../../lib/rbac-seed"

export type PermissionRow = {
  id: string
  key: string
  label: string
  module: string
}

export type RoleRow = {
  id: string
  name: string
  description: string | null
  created_at: string
}

export type TeamRow = {
  id: string
  name: string
  created_at: string
  member_count: number
}

export type UserOption = {
  id: string
  name: string
  email: string
}

export type TeamMemberRow = {
  id: string
  user_id: string
  user_name: string
  user_email: string
}

async function guardRbac() {
  const ctx = await getContext()
  const { ensureRbacTables } = await import("../../lib/rbac-schema")
  const { getUserTeams } = await import("../../lib/authz")

  await ensureRbacTables()
  await seedBasePermissions()
  await ensureDefaultTeamAdminRole()
  await seedBaseRoles()
  await getUserTeams(ctx.tenantId, ctx.userId)
  await requirePermission(ctx.tenantId, ctx.userId, "rbac_admin:manage")
  return ctx
}

export type RbacInitialData = {
  roles: RoleRow[]
  permissions: PermissionRow[]
  teams: TeamRow[]
}

/** Carrega roles, permissions e teams em uma única requisição (1x guardRbac). */
export async function listRbacInitialData(): Promise<RbacInitialData> {
  const ctx = await guardRbac()
  const [rolesRes, permsRes, teamsRes] = await Promise.all([
    sql<RoleRow>`
      SELECT id::text AS id, name::text AS name, description::text AS description, created_at::text AS created_at
      FROM roles
      WHERE tenant_id = ${ctx.tenantId}::uuid
      ORDER BY name
    `,
    sql<PermissionRow>`
      SELECT id::text AS id, key::text AS key, label::text AS label, module::text AS module
      FROM permissions
      WHERE tenant_id = ${ctx.tenantId}::uuid
      ORDER BY module, key
    `,
    sql<TeamRow & { member_count: number }>`
      SELECT
        t.id::text AS id,
        t.name::text AS name,
        t.created_at::text AS created_at,
        COUNT(tm.user_id)::int AS member_count
      FROM teams t
      LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.tenant_id = t.tenant_id
      WHERE t.tenant_id = ${ctx.tenantId}::uuid
      GROUP BY t.id, t.name, t.created_at
      ORDER BY t.name
    `,
  ])
  return {
    roles: rolesRes.rows,
    permissions: permsRes.rows,
    teams: teamsRes.rows,
  }
}

export async function listPermissions(): Promise<PermissionRow[]> {
  const ctx = await guardRbac()
  const { rows } = await sql<PermissionRow>`
    SELECT id::text AS id, key::text AS key, label::text AS label, module::text AS module
    FROM permissions
    WHERE tenant_id = ${ctx.tenantId}::uuid
    ORDER BY module, key
  `
  return rows
}

export async function listRoles(): Promise<RoleRow[]> {
  const ctx = await guardRbac()
  const { rows } = await sql<RoleRow>`
    SELECT id::text AS id, name::text AS name, description::text AS description, created_at::text AS created_at
    FROM roles
    WHERE tenant_id = ${ctx.tenantId}::uuid
    ORDER BY name
  `
  return rows
}

/** Criação de novas roles desabilitada: use apenas os perfis predefinidos. */
export async function createRole(_name: string, _description?: string | null): Promise<string> {
  await guardRbac()
  throw new Error("Criação de novas roles desabilitada. Use e edite os perfis predefinidos.")
}

export async function updateRole(
  roleId: string,
  name: string,
  description?: string | null
): Promise<void> {
  await guardRbac()
  await sql`
    UPDATE roles
    SET name = ${name.trim()}, description = ${description?.trim() || null}
    WHERE tenant_id = (SELECT tenant_id FROM roles WHERE id = ${roleId}::uuid LIMIT 1)
      AND id = ${roleId}::uuid
  `
  revalidatePath("/admin/rbac")
  revalidatePath("/configuracoes")
}

export async function getRolePermissions(roleId: string): Promise<Set<string>> {
  const ctx = await guardRbac()
  const { rows } = await sql<{ key: string }>`
    SELECT p.key::text AS key
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id AND p.tenant_id = rp.tenant_id
    WHERE rp.tenant_id = ${ctx.tenantId}::uuid AND rp.role_id = ${roleId}::uuid
  `
  return new Set(rows.map((r) => r.key))
}

export async function upsertRolePermissions(
  roleId: string,
  permissionKeys: string[]
): Promise<void> {
  const ctx = await guardRbac()

  const keysSet = new Set(permissionKeys)
  const perms = await sql<{ id: string; key: string }>`
    SELECT id::text AS id, key::text AS key
    FROM permissions
    WHERE tenant_id = ${ctx.tenantId}::uuid
  `
  const keyToId = new Map(perms.rows.map((p) => [p.key, p.id]))
  const idToKey = new Map(perms.rows.map((p) => [p.id, p.key]))

  const current = await sql<{ permission_id: string }>`
    SELECT permission_id::text AS permission_id
    FROM role_permissions
    WHERE tenant_id = ${ctx.tenantId}::uuid AND role_id = ${roleId}::uuid
  `

  for (const key of keysSet) {
    const permId = keyToId.get(key)
    if (!permId) continue
    const exists = current.rows.some((r) => r.permission_id === permId)
    if (!exists) {
      await sql`
        INSERT INTO role_permissions (tenant_id, role_id, permission_id)
        VALUES (${ctx.tenantId}::uuid, ${roleId}::uuid, ${permId}::uuid)
        ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING
      `
    }
  }

  for (const row of current.rows) {
    const key = idToKey.get(row.permission_id)
    if (key && !keysSet.has(key)) {
      await sql`
        DELETE FROM role_permissions
        WHERE tenant_id = ${ctx.tenantId}::uuid
          AND role_id = ${roleId}::uuid
          AND permission_id = ${row.permission_id}::uuid
      `
    }
  }

  revalidatePath("/admin/rbac")
  revalidatePath("/configuracoes")
}

export async function listTeams(): Promise<TeamRow[]> {
  const ctx = await guardRbac()
  const { rows } = await sql<TeamRow & { member_count: number }>`
    SELECT
      t.id::text AS id,
      t.name::text AS name,
      t.created_at::text AS created_at,
      COUNT(tm.user_id)::int AS member_count
    FROM teams t
    LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.tenant_id = t.tenant_id
    WHERE t.tenant_id = ${ctx.tenantId}::uuid
    GROUP BY t.id, t.name, t.created_at
    ORDER BY t.name
  `
  return rows
}

export async function createTeam(name: string): Promise<string> {
  const ctx = await guardRbac()
  const { rows } = await sql<{ id: string }>`
    INSERT INTO teams (tenant_id, name)
    VALUES (${ctx.tenantId}::uuid, ${name.trim()})
    RETURNING id::text AS id
  `
  revalidatePath("/admin/rbac")
  revalidatePath("/configuracoes")
  return rows[0]?.id ?? ""
}

export async function updateTeam(teamId: string, name: string): Promise<void> {
  await guardRbac()
  await sql`
    UPDATE teams
    SET name = ${name.trim()}
    WHERE tenant_id = (SELECT tenant_id FROM teams WHERE id = ${teamId}::uuid LIMIT 1)
      AND id = ${teamId}::uuid
  `
  revalidatePath("/admin/rbac")
  revalidatePath("/configuracoes")
}

export async function searchUsers(q: string): Promise<UserOption[]> {
  const ctx = await guardRbac()
  const term = `%${(q || "").trim()}%`
  if (!term || term === "%%") return []
  const { rows } = await sql<UserOption>`
    SELECT id::text AS id, name::text AS name, email::text AS email
    FROM users
    WHERE tenant_id = ${ctx.tenantId}::uuid
      AND (name ILIKE ${term} OR email ILIKE ${term})
    ORDER BY name
    LIMIT 20
  `
  return rows
}

export async function getTeamMembers(teamId: string): Promise<TeamMemberRow[]> {
  const ctx = await guardRbac()
  const { rows } = await sql<TeamMemberRow>`
    SELECT
      tm.id::text AS id,
      tm.user_id::text AS user_id,
      u.name::text AS user_name,
      u.email::text AS user_email
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id AND u.tenant_id = tm.tenant_id
    WHERE tm.tenant_id = ${ctx.tenantId}::uuid AND tm.team_id = ${teamId}::uuid
    ORDER BY u.name
  `
  return rows
}

export async function addTeamMember(teamId: string, userId: string): Promise<void> {
  const ctx = await guardRbac()
  await sql`
    INSERT INTO team_members (tenant_id, team_id, user_id)
    VALUES (${ctx.tenantId}::uuid, ${teamId}::uuid, ${userId}::uuid)
    ON CONFLICT (tenant_id, team_id, user_id) DO NOTHING
  `
  revalidatePath("/admin/rbac")
  revalidatePath("/configuracoes")
}

export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  const ctx = await guardRbac()
  await sql`
    DELETE FROM team_members
    WHERE tenant_id = ${ctx.tenantId}::uuid
      AND team_id = ${teamId}::uuid
      AND user_id = ${userId}::uuid
  `
  revalidatePath("/admin/rbac")
  revalidatePath("/configuracoes")
}

export async function getTeamRoles(teamId: string): Promise<Set<string>> {
  const ctx = await guardRbac()
  const { rows } = await sql<{ role_id: string }>`
    SELECT role_id::text AS role_id
    FROM team_roles
    WHERE tenant_id = ${ctx.tenantId}::uuid AND team_id = ${teamId}::uuid
  `
  return new Set(rows.map((r) => r.role_id))
}

export async function upsertTeamRoles(teamId: string, roleIds: string[]): Promise<void> {
  const ctx = await guardRbac()

  const current = await sql<{ role_id: string }>`
    SELECT role_id::text AS role_id
    FROM team_roles
    WHERE tenant_id = ${ctx.tenantId}::uuid AND team_id = ${teamId}::uuid
  `
  const currentSet = new Set(current.rows.map((r) => r.role_id))

  for (const roleId of roleIds) {
    if (!currentSet.has(roleId)) {
      await sql`
        INSERT INTO team_roles (tenant_id, team_id, role_id)
        VALUES (${ctx.tenantId}::uuid, ${teamId}::uuid, ${roleId}::uuid)
        ON CONFLICT (tenant_id, team_id, role_id) DO NOTHING
      `
    }
  }

  for (const row of current.rows) {
    if (!roleIds.includes(row.role_id)) {
      await sql`
        DELETE FROM team_roles
        WHERE tenant_id = ${ctx.tenantId}::uuid
          AND team_id = ${teamId}::uuid
          AND role_id = ${row.role_id}::uuid
      `
    }
  }

  revalidatePath("/admin/rbac")
  revalidatePath("/configuracoes")
}
