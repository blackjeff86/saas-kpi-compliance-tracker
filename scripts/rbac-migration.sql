-- RBAC Migration - Team-based RBAC
-- Execute manually or use the ensureRbacTables() server action
-- All tables require tenant_id uuid NOT NULL

-- 1) teams
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teams_tenant ON teams(tenant_id);

-- 2) team_members
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_tenant ON team_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(tenant_id, user_id);

-- 3) roles
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);

-- 4) permissions
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  module text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, key)
);
CREATE INDEX IF NOT EXISTS idx_permissions_tenant ON permissions(tenant_id);

-- 5) role_permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  tenant_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, role_id, permission_id)
);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(tenant_id, role_id);

-- 6) team_roles
CREATE TABLE IF NOT EXISTS team_roles (
  tenant_id uuid NOT NULL,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, team_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_team_roles_team ON team_roles(tenant_id, team_id);

-- 7) Add team_id to main tables
ALTER TABLE controls ADD COLUMN IF NOT EXISTS team_id uuid NULL;
ALTER TABLE risk_catalog ADD COLUMN IF NOT EXISTS team_id uuid NULL;
ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS team_id uuid NULL;
ALTER TABLE audit_campaigns ADD COLUMN IF NOT EXISTS team_id uuid NULL;
