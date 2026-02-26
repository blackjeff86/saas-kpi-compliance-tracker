// app/(app)/lib/rbac-schema.ts
"use server"

import { sql } from "@vercel/postgres"

let _rbacEnsured = false

/**
 * Cria as tabelas RBAC se não existirem.
 * Todas com tenant_id uuid not null.
 * Cache por processo: só executa uma vez por instância Node.
 */
export async function ensureRbacTables() {
  if (_rbacEnsured) return

  // Lote 1: tabelas independentes em paralelo
  await Promise.all([
    sql`CREATE TABLE IF NOT EXISTS teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      name text NOT NULL,
      created_at timestamptz DEFAULT now()
    )`,
    sql`CREATE TABLE IF NOT EXISTS roles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      name text NOT NULL,
      description text NULL,
      created_at timestamptz DEFAULT now()
    )`,
    sql`CREATE TABLE IF NOT EXISTS permissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      key text NOT NULL,
      label text NOT NULL,
      module text NOT NULL,
      created_at timestamptz DEFAULT now(),
      UNIQUE(tenant_id, key)
    )`,
  ])

  // Lote 2: tabelas com FKs em paralelo
  await Promise.all([
    sql`CREATE TABLE IF NOT EXISTS team_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(tenant_id, team_id, user_id)
    )`,
    sql`CREATE TABLE IF NOT EXISTS role_permissions (
      tenant_id uuid NOT NULL,
      role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      UNIQUE(tenant_id, role_id, permission_id)
    )`,
    sql`CREATE TABLE IF NOT EXISTS team_roles (
      tenant_id uuid NOT NULL,
      team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      UNIQUE(tenant_id, team_id, role_id)
    )`,
  ])

  // Índices em paralelo
  await Promise.all([
    sql`CREATE INDEX IF NOT EXISTS idx_teams_tenant ON teams(tenant_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_team_members_tenant ON team_members(tenant_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(tenant_id, user_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_permissions_tenant ON permissions(tenant_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(tenant_id, role_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_team_roles_team ON team_roles(tenant_id, team_id)`,
  ])

  _rbacEnsured = true
}
