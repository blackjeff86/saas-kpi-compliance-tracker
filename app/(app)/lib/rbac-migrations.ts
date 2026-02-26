// app/(app)/lib/rbac-migrations.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "./context"
import { ensureRbacTables } from "./rbac-schema"

let _teamIdColumnsEnsured = false
let _auditCampaignsEnsured = false

/**
 * Cria as tabelas de campanhas de auditoria se não existirem.
 * Chamado antes de createAuditCampaign e por ensureTeamIdColumns.
 */
export async function ensureAuditCampaignsTables() {
  if (_auditCampaignsEnsured) return

  await sql`CREATE TABLE IF NOT EXISTS audit_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    framework text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    objective text NULL,
    status text NOT NULL DEFAULT 'active',
    drive_folder_id text NULL,
    drive_folder_url text NULL,
    created_by uuid NULL,
    team_id uuid NULL,
    created_at timestamptz DEFAULT now()
  )`
  await sql`ALTER TABLE audit_campaigns ADD COLUMN IF NOT EXISTS sampling_info text NULL`
  await sql`ALTER TABLE audit_campaigns ADD COLUMN IF NOT EXISTS delivery_deadline date NULL`
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_campaigns_tenant ON audit_campaigns(tenant_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_campaigns_team ON audit_campaigns(tenant_id, team_id)`

  await sql`CREATE TABLE IF NOT EXISTS audit_campaign_controls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    control_id uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(tenant_id, campaign_id, control_id)
  )`
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_campaign_controls_campaign ON audit_campaign_controls(campaign_id)`

  await sql`CREATE TABLE IF NOT EXISTS audit_request_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    control_id uuid NULL,
    title text NOT NULL,
    instructions text NULL,
    item_type text NOT NULL DEFAULT 'any',
    sampling_info text NULL,
    delivery_deadline date NULL,
    position int NOT NULL DEFAULT 1,
    created_at timestamptz DEFAULT now()
  )`
  await sql`ALTER TABLE audit_request_items ADD COLUMN IF NOT EXISTS control_id uuid NULL`
  await sql`ALTER TABLE audit_request_items ADD COLUMN IF NOT EXISTS sampling_info text NULL`
  await sql`ALTER TABLE audit_request_items ADD COLUMN IF NOT EXISTS delivery_deadline date NULL`
  await sql`ALTER TABLE audit_request_items ADD COLUMN IF NOT EXISTS requester_team_id uuid NULL`
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_request_items_campaign ON audit_request_items(campaign_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_request_items_control ON audit_request_items(control_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_request_items_requester_team ON audit_request_items(requester_team_id)`

  _auditCampaignsEnsured = true
}

/**
 * Adiciona team_id nas tabelas principais.
 * Para registros existentes: atribui ao Default Team do tenant.
 * Cache por processo: só executa uma vez por instância Node.
 */
export async function ensureTeamIdColumns() {
  if (_teamIdColumnsEnsured) return

  const ctx = await getContext()
  await ensureRbacTables()
  await ensureAuditCampaignsTables()

  // controls
  await sql`ALTER TABLE controls ADD COLUMN IF NOT EXISTS team_id uuid NULL`
  await sql`ALTER TABLE controls ADD COLUMN IF NOT EXISTS area text NULL`
  await sql`CREATE INDEX IF NOT EXISTS idx_controls_team ON controls(tenant_id, team_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_controls_area ON controls(tenant_id, area)`

  // risk_catalog (risks)
  await sql`ALTER TABLE risk_catalog ADD COLUMN IF NOT EXISTS team_id uuid NULL`
  await sql`CREATE INDEX IF NOT EXISTS idx_risk_catalog_team ON risk_catalog(tenant_id, team_id)`

  // action_plans
  await sql`ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS team_id uuid NULL`
  await sql`CREATE INDEX IF NOT EXISTS idx_action_plans_team ON action_plans(tenant_id, team_id)`

  // audit_campaigns (se existir)
  try {
    await sql`ALTER TABLE audit_campaigns ADD COLUMN IF NOT EXISTS team_id uuid NULL`
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_campaigns_team ON audit_campaigns(tenant_id, team_id)`
  } catch {
    // tabela pode não existir
  }

  // Criar Default Team se não existir
  let defaultTeam = await getDefaultTeamForTenant(ctx.tenantId)
  if (!defaultTeam) {
    const ins = await sql<{ id: string }>`
      INSERT INTO teams (tenant_id, name)
      VALUES (${ctx.tenantId}::uuid, 'Default')
      RETURNING id::text AS id
    `
    defaultTeam = ins.rows[0]?.id ?? null
  }

  if (defaultTeam) {
    await sql`
      UPDATE controls
      SET team_id = ${defaultTeam}::uuid
      WHERE tenant_id = ${ctx.tenantId}::uuid AND team_id IS NULL
    `
    await sql`
      UPDATE risk_catalog
      SET team_id = ${defaultTeam}::uuid
      WHERE tenant_id = ${ctx.tenantId}::uuid AND team_id IS NULL
    `
    await sql`
      UPDATE action_plans
      SET team_id = ${defaultTeam}::uuid
      WHERE tenant_id = ${ctx.tenantId}::uuid AND team_id IS NULL
    `
    try {
      await sql`
        UPDATE audit_campaigns
        SET team_id = ${defaultTeam}::uuid
        WHERE tenant_id = ${ctx.tenantId}::uuid AND team_id IS NULL
      `
    } catch {
      // ignore
    }
  }

  _teamIdColumnsEnsured = true
}

async function getDefaultTeamForTenant(tenantId: string): Promise<string | null> {
  const found = await sql<{ id: string }>`
    SELECT id::text AS id
    FROM teams
    WHERE tenant_id = ${tenantId}::uuid
      AND LOWER(name) = 'default'
    LIMIT 1
  `
  return found.rows[0]?.id ?? null
}
