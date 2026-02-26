// app/(app)/lib/rbac-seed.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "./context"
import { ensureRbacTables } from "./rbac-schema"

const _seededTenants = new Set<string>()
const _defaultTeamAdminTenants = new Set<string>()
const _baseRolesTenants = new Set<string>()

/** Perfis padrão: usuário só edita permissões, não cria novas roles. */
const BASE_ROLES: Array<{
  name: string
  description: string
  permissionKeys: string[]
}> = [
  {
    name: "Admin",
    description: "Acesso total ao sistema e gestão RBAC",
    permissionKeys: [], // já configurado em ensureDefaultTeamAdminRole
  },
  {
    name: "Analista",
    description: "Compliance Officer - visão ampla e edição operacional",
    permissionKeys: [
      "dashboard:view_all",
      "controls:view_all",
      "controls:edit",
      "risks:view_all",
      "risks:edit",
      "action_plans:view_all",
      "action_plans:edit",
      "audit_campaigns:view_all",
      "audit_campaigns:create",
      "audit_campaigns:edit",
      "evidence_requests:view_all",
      "evidence_requests:create",
    ],
  },
  {
    name: "Revisor GRC",
    description: "Revisões GRC e evidências - sem edição",
    permissionKeys: [
      "dashboard:view_all",
      "controls:view_all",
      "risks:view_all",
      "action_plans:view_all",
      "audit_campaigns:view",
      "audit_campaigns:view_all",
      "evidence_requests:view",
      "evidence_requests:view_all",
      "evidence_requests:review",
    ],
  },
  {
    name: "Operador",
    description: "Visão restrita ao próprio time",
    permissionKeys: [
      "dashboard:view",
      "controls:view",
      "risks:view",
      "action_plans:view",
    ],
  },
  {
    name: "Auditor",
    description: "Campanhas e evidências de auditoria",
    permissionKeys: [
      "audit_campaigns:view",
      "audit_campaigns:view_all",
      "audit_campaigns:create",
      "audit_campaigns:edit",
      "evidence_requests:view",
      "evidence_requests:view_all",
      "evidence_requests:create",
      "evidence_requests:review",
    ],
  },
]

const BASE_PERMISSIONS: Array<{ key: string; label: string; module: string }> = [
  { key: "dashboard:view", label: "Visualizar Dashboard (escopo próprio)", module: "Dashboard" },
  { key: "dashboard:view_all", label: "Visualizar Dashboard (todos os times)", module: "Dashboard" },
  { key: "controls:view", label: "Visualizar Controles", module: "Controles" },
  { key: "controls:view_all", label: "Visualizar todos os Controles", module: "Controles" },
  { key: "controls:edit", label: "Editar Controles", module: "Controles" },
  { key: "risks:view", label: "Visualizar Riscos", module: "Riscos" },
  { key: "risks:view_all", label: "Visualizar todos os Riscos", module: "Riscos" },
  { key: "risks:edit", label: "Editar Riscos", module: "Riscos" },
  { key: "action_plans:view", label: "Visualizar Planos de Ação", module: "Planos de Ação" },
  { key: "action_plans:view_all", label: "Visualizar todos os Planos de Ação", module: "Planos de Ação" },
  { key: "action_plans:edit", label: "Editar Planos de Ação", module: "Planos de Ação" },
  { key: "audit_campaigns:view", label: "Visualizar Campanhas de Auditoria", module: "Auditoria" },
  { key: "audit_campaigns:view_all", label: "Visualizar todas as Campanhas", module: "Auditoria" },
  { key: "audit_campaigns:create", label: "Criar Campanhas de Auditoria", module: "Auditoria" },
  { key: "audit_campaigns:edit", label: "Editar Campanhas de Auditoria", module: "Auditoria" },
  { key: "evidence_requests:view", label: "Visualizar Request List de Evidências", module: "Auditoria" },
  { key: "evidence_requests:view_all", label: "Visualizar todas as Evidências", module: "Auditoria" },
  { key: "evidence_requests:create", label: "Criar Request List de Evidências", module: "Auditoria" },
  { key: "evidence_requests:review", label: "Revisar Evidências", module: "Auditoria" },
  { key: "rbac_admin:manage", label: "Gerenciar RBAC (Admin)", module: "Admin" },
]

/**
 * Insere as permissões base no tenant se não existirem.
 * Cache por processo: só executa uma vez por tenant.
 */
export async function seedBasePermissions() {
  const ctx = await getContext()
  if (_seededTenants.has(ctx.tenantId)) return
  await ensureRbacTables()

  for (const p of BASE_PERMISSIONS) {
    await sql`
      INSERT INTO permissions (tenant_id, key, label, module)
      VALUES (${ctx.tenantId}::uuid, ${p.key}, ${p.label}, ${p.module})
      ON CONFLICT (tenant_id, key) DO NOTHING
    `
  }
  _seededTenants.add(ctx.tenantId)
}

/**
 * Garante que o Default Team existe e tem a Role "Admin" com rbac_admin:manage.
 * Assim o primeiro usuário (ou admin) não fica trancado.
 * Cache por processo: só executa uma vez por tenant.
 */
export async function ensureDefaultTeamAdminRole() {
  const ctx = await getContext()
  if (_defaultTeamAdminTenants.has(ctx.tenantId)) return
  await ensureRbacTables()
  await seedBasePermissions()

  // Default team
  const teamRes = await sql<{ id: string }>`
    SELECT id FROM teams
    WHERE tenant_id = ${ctx.tenantId}::uuid AND LOWER(name) = 'default'
    LIMIT 1
  `
  const teamId = teamRes.rows[0]?.id
  if (!teamId) return // será criado no primeiro getUserTeams

  // Role Admin
  let roleRes = await sql<{ id: string }>`
    SELECT id FROM roles
    WHERE tenant_id = ${ctx.tenantId}::uuid AND LOWER(name) = 'admin'
    LIMIT 1
  `
  if (!roleRes.rows[0]?.id) {
    await sql`
      INSERT INTO roles (tenant_id, name, description)
      VALUES (${ctx.tenantId}::uuid, 'Admin', 'Acesso total ao sistema')
      RETURNING id
    `
    roleRes = await sql<{ id: string }>`
      SELECT id FROM roles
      WHERE tenant_id = ${ctx.tenantId}::uuid AND LOWER(name) = 'admin'
      LIMIT 1
    `
  }
  const roleId = roleRes.rows[0]?.id
  if (!roleId) return

  // rbac_admin:manage permission
  const permRes = await sql<{ id: string }>`
    SELECT id FROM permissions
    WHERE tenant_id = ${ctx.tenantId}::uuid AND key = 'rbac_admin:manage'
    LIMIT 1
  `
  const permId = permRes.rows[0]?.id
  if (!permId) return

  // Attach role to team
  await sql`
    INSERT INTO team_roles (tenant_id, team_id, role_id)
    VALUES (${ctx.tenantId}::uuid, ${teamId}::uuid, ${roleId}::uuid)
    ON CONFLICT (tenant_id, team_id, role_id) DO NOTHING
  `

  // Attach rbac_admin:manage to Admin role
  await sql`
    INSERT INTO role_permissions (tenant_id, role_id, permission_id)
    VALUES (${ctx.tenantId}::uuid, ${roleId}::uuid, ${permId}::uuid)
    ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING
  `

  // Attach all permissions to Admin role (para não trancar)
  const allPerms = await sql<{ id: string }>`
    SELECT id FROM permissions WHERE tenant_id = ${ctx.tenantId}::uuid
  `
  for (const p of allPerms.rows) {
    await sql`
      INSERT INTO role_permissions (tenant_id, role_id, permission_id)
      VALUES (${ctx.tenantId}::uuid, ${roleId}::uuid, ${p.id}::uuid)
      ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING
    `
  }

  _defaultTeamAdminTenants.add(ctx.tenantId)
}

/**
 * Garante que as roles base existem.
 * Cache por processo: só executa uma vez por tenant.
 */
export async function seedBaseRoles() {
  const ctx = await getContext()
  if (_baseRolesTenants.has(ctx.tenantId)) return
  await ensureRbacTables()
  await seedBasePermissions()

  const permRows = await sql<{ id: string; key: string }>`
    SELECT id::text AS id, key::text AS key
    FROM permissions WHERE tenant_id = ${ctx.tenantId}::uuid
  `
  const keyToId = new Map(permRows.rows.map((p) => [p.key, p.id]))

  for (const r of BASE_ROLES) {
    let roleId: string | null = null
    const existingRole = await sql<{ id: string }>`
      SELECT id::text AS id FROM roles
      WHERE tenant_id = ${ctx.tenantId}::uuid AND LOWER(name) = ${r.name.toLowerCase()}
      LIMIT 1
    `
    roleId = existingRole.rows[0]?.id ?? null

    if (!roleId) {
      const ins = await sql<{ id: string }>`
        INSERT INTO roles (tenant_id, name, description)
        VALUES (${ctx.tenantId}::uuid, ${r.name}, ${r.description})
        RETURNING id::text AS id
      `
      roleId = ins.rows[0]?.id ?? null
    }

    if (roleId && r.permissionKeys.length > 0) {
      for (const key of r.permissionKeys) {
        const permId = keyToId.get(key)
        if (permId) {
          await sql`
            INSERT INTO role_permissions (tenant_id, role_id, permission_id)
            VALUES (${ctx.tenantId}::uuid, ${roleId}::uuid, ${permId}::uuid)
            ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING
          `
        }
      }
    }
  }

  _baseRolesTenants.add(ctx.tenantId)
}
